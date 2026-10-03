// Development server utilities with hot reload and live preview

import * as http from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';
import { watch } from 'chokidar';
import { WebSocketServer, WebSocket } from 'ws';
import chalk from 'chalk';

export interface DevServerOptions {
  port: number;
  host: string;
  projectDir: string;
  open?: boolean;
}

export class DevServer {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private watcher: any = null;

  constructor(private options: DevServerOptions) {}

  async start(): Promise<void> {
    const { port, host, projectDir } = this.options;

    // Create HTTP server
    this.server = http.createServer(async (req, res) => {
      await this.handleRequest(req, res);
    });

    // Create WebSocket server for hot reload
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });

    // Start file watcher
    this.startWatcher(projectDir);

    // Start server
    return new Promise((resolve, reject) => {
      this.server!.listen(port, host, () => {
        console.log();
        console.log(chalk.green('✓ Development server started'));
        console.log();
        console.log(chalk.cyan('  Local:   ') + chalk.bold(`http://${host}:${port}`));
        console.log(chalk.cyan('  Network: ') + chalk.bold(`http://localhost:${port}`));
        console.log();
        console.log(chalk.gray('  Press Ctrl+C to stop'));
        console.log();
        resolve();
      });

      this.server!.on('error', reject);
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const { projectDir } = this.options;
    let filePath = req.url === '/' ? '/src/index.html' : req.url || '/src/index.html';

    // Remove query string
    filePath = filePath.split('?')[0];

    const fullPath = path.join(projectDir, filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const ext = path.extname(filePath);

      // Set content type
      const contentTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      };

      res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');

      // Inject hot reload script for HTML files
      if (ext === '.html') {
        const injectedContent = this.injectHotReloadScript(content);
        res.end(injectedContent);
      } else {
        res.end(content);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
    }
  }

  private injectHotReloadScript(html: string): string {
    const script = `
<script>
(function() {
  const ws = new WebSocket('ws://' + location.host);
  ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.type === 'reload') {
      console.log('[DGOS] Reloading due to file change:', data.file);
      location.reload();
    }
  };
  ws.onclose = function() {
    console.log('[DGOS] Dev server disconnected. Please refresh manually.');
  };
  console.log('[DGOS] Hot reload enabled');
})();
</script>
`;

    // Inject before closing </body> or </head> or at the end
    if (html.includes('</body>')) {
      return html.replace('</body>', `${script}</body>`);
    } else if (html.includes('</head>')) {
      return html.replace('</head>', `${script}</head>`);
    } else {
      return html + script;
    }
  }

  private startWatcher(projectDir: string): void {
    this.watcher = watch([path.join(projectDir, 'src'), path.join(projectDir, 'public')], {
      ignoreInitial: true,
      ignored: /(^|[\/\\])\../, // ignore dotfiles
    });

    this.watcher.on('change', (filePath: string) => {
      console.log(chalk.gray(`[${new Date().toLocaleTimeString()}]`), chalk.cyan('File changed:'), path.basename(filePath));
      this.notifyClients('reload', { file: path.basename(filePath) });
    });

    this.watcher.on('add', (filePath: string) => {
      console.log(chalk.gray(`[${new Date().toLocaleTimeString()}]`), chalk.green('File added:'), path.basename(filePath));
      this.notifyClients('reload', { file: path.basename(filePath) });
    });
  }

  private notifyClients(type: string, data: any): void {
    const message = JSON.stringify({ type, ...data });
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }

    if (this.wss) {
      this.wss.close();
    }

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => resolve());
      });
    }
  }
}
