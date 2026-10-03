// Example: Integrating Toast Notifications into existing components
import { useToast } from '@dgos/dgos-ui';

// In your component
function ProviderConfig() {
  const toast = useToast();
  const op = useOperation();

  async function validateConnection() {
    const result = await op.run(
      () => api(`/api/v1/provider/configs/${configId}/validate`),
      '' // No inline success message
    );

    if (result) {
      toast.success('Connection validated successfully', {
        duration: 5000,
        action: {
          label: 'Refresh Models',
          onClick: () => refreshModels()
        }
      });
    } else if (op.error) {
      toast.error(`Validation failed: ${op.error}`, {
        duration: 8000
      });
    }
  }

  return (
    // ... your component
  );
}

// Example: Using enhanced forms with validation
import { FormInput, FormSelect, validators } from '@dgos/dgos-ui';

function AddProviderForm() {
  const [formErrors, setFormErrors] = useState({});

  return (
    <form onSubmit={handleSubmit}>
      <FormInput
        id="provider-name"
        label="Provider Name"
        name="displayName"
        autoFocus
        required
        validate={validators.combine(
          validators.required(),
          validators.minLength(3, 'Name must be at least 3 characters')
        )}
        hint="A friendly name for this provider"
        error={formErrors.displayName}
      />

      <FormInput
        id="base-url"
        label="Base URL"
        name="baseUrl"
        type="url"
        required
        validate={validators.url('Please enter a valid URL')}
        hint="e.g., https://api.openai.com/v1"
        error={formErrors.baseUrl}
      />

      <FormInput
        id="api-key"
        label="API Key"
        name="credential"
        type="password"
        required
        validate={validators.minLength(20, 'API key seems too short')}
        hint="Your provider API key"
        error={formErrors.credential}
      />

      <Button type="submit" variant="primary" busy={busy}>
        Add Provider
      </Button>
    </form>
  );
}

// Example: Using loading states
import { SkeletonList, ProgressBar, LoadingOverlay } from '@dgos/dgos-ui';

function ProviderList() {
  const { data, loading, error } = useResource('/api/v1/provider/configs');
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);

  if (loading && !data) {
    return <SkeletonList rows={5} />;
  }

  return (
    <div>
      {installing && (
        <LoadingOverlay message="Installing package..." />
      )}

      {progress > 0 && progress < 100 && (
        <ProgressBar
          value={progress}
          label="Downloading models"
          variant="default"
        />
      )}

      {/* Your list content */}
    </div>
  );
}

// Example: Keyboard shortcuts
import { useShortcut } from '@dgos/dgos-ui';

function TaskView() {
  const [showNewTask, setShowNewTask] = useState(false);

  // ⌘N to create new task
  useShortcut(
    {
      key: 'n',
      meta: true,
      description: 'Create new task',
      global: false
    },
    () => setShowNewTask(true),
    []
  );

  // ⌘R to refresh
  useShortcut(
    {
      key: 'r',
      meta: true,
      description: 'Refresh tasks',
      global: false
    },
    () => resource.reload(),
    [resource]
  );

  return (
    // ... your component
  );
}

// Example: Wrapping your app with providers
import { ToastProvider, KeyboardProvider } from '@dgos/dgos-ui';

function AppRoot() {
  return (
    <KeyboardProvider>
      <ToastProvider>
        <YourExistingApp />
      </ToastProvider>
    </KeyboardProvider>
  );
}

// Example: Replacing inline alerts with toasts
// BEFORE:
function OldComponent() {
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function save() {
    try {
      await api.save();
      setNotice('Saved successfully');
    } catch (e) {
      setError('Save failed');
    }
  }

  return (
    <>
      {notice && <Alert kind="info">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}
      {/* ... */}
    </>
  );
}

// AFTER:
function NewComponent() {
  const toast = useToast();

  async function save() {
    try {
      await api.save();
      toast.success('Saved successfully');
    } catch (e) {
      toast.error('Save failed');
    }
  }

  return (
    // ... no need for notice/error state
  );
}

// Example: Optimistic UI with toast feedback
function ToggleFeature({ featureId, enabled }) {
  const toast = useToast();
  const [localEnabled, setLocalEnabled] = useState(enabled);

  async function toggle() {
    const newState = !localEnabled;

    // Optimistic update
    setLocalEnabled(newState);
    toast.info(newState ? 'Enabling...' : 'Disabling...');

    try {
      await api.toggle(featureId, newState);
      toast.success(newState ? 'Enabled' : 'Disabled');
    } catch (e) {
      // Rollback on error
      setLocalEnabled(!newState);
      toast.error('Failed to update. Please try again.');
    }
  }

  return (
    <button onClick={toggle}>
      {localEnabled ? 'Enabled' : 'Disabled'}
    </button>
  );
}

// Example: Form with progressive validation
function SignupForm() {
  const toast = useToast();

  const emailValidator = (value: string) => {
    if (!value) return 'Email is required';
    if (!validators.email()(value)) return 'Invalid email format';
    // Could add async check for existing email
    return null;
  };

  const passwordValidator = (value: string) => {
    if (value.length < 8) return 'Minimum 8 characters';
    if (!/[A-Z]/.test(value)) return 'Must contain uppercase letter';
    if (!/[0-9]/.test(value)) return 'Must contain number';
    return null;
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormInput
        label="Email"
        type="email"
        autoFocus
        required
        validate={emailValidator}
      />

      <FormInput
        label="Password"
        type="password"
        required
        validate={passwordValidator}
        hint="At least 8 characters with uppercase and number"
      />

      <Button type="submit" variant="primary">
        Sign Up
      </Button>
    </form>
  );
}

// Example: Complex validation with multiple fields
function ProviderConfigAdvanced() {
  const [config, setConfig] = useState({
    endpoint: '',
    timeout: 30,
    retries: 3
  });

  const endpointValidator = (value: string) => {
    if (!value) return 'Endpoint is required';

    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return 'Only HTTP/HTTPS protocols supported';
      }
      return null;
    } catch {
      return 'Invalid URL format';
    }
  };

  const timeoutValidator = (value: string) => {
    const num = Number(value);
    if (isNaN(num)) return 'Must be a number';
    if (num < 1) return 'Minimum 1 second';
    if (num > 300) return 'Maximum 300 seconds';
    return null;
  };

  return (
    <FormGroup legend="Connection Settings">
      <FormInput
        label="Endpoint"
        value={config.endpoint}
        onChange={e => setConfig({ ...config, endpoint: e.target.value })}
        validate={endpointValidator}
        hint="Full URL including protocol"
      />

      <FormInput
        label="Timeout (seconds)"
        type="number"
        min="1"
        max="300"
        value={config.timeout}
        onChange={e => setConfig({ ...config, timeout: Number(e.target.value) })}
        validate={timeoutValidator}
      />

      <FormInput
        label="Retry Attempts"
        type="number"
        min="0"
        max="10"
        value={config.retries}
        onChange={e => setConfig({ ...config, retries: Number(e.target.value) })}
      />
    </FormGroup>
  );
}

// Example: Multi-step form with progress
function MultiStepWizard() {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  return (
    <div>
      <ProgressBar
        value={step}
        max={totalSteps}
        label={`Step ${step} of ${totalSteps}`}
        showPercentage={false}
      />

      {step === 1 && <StepOne onNext={() => setStep(2)} />}
      {step === 2 && <StepTwo onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <StepThree onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <StepFour onBack={() => setStep(3)} />}
    </div>
  );
}
