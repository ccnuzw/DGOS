# DGOS Application Publishing Guidelines

> Complete guide to publishing applications to the DGOS app store

## Table of Contents

1. [Overview](#overview)
2. [Pre-Publish Checklist](#pre-publish-checklist)
3. [Review Criteria](#review-criteria)
4. [Version Management](#version-management)
5. [Update Process](#update-process)
6. [Publishing Steps](#publishing-steps)
7. [Release Channels](#release-channels)
8. [App Store Listing](#app-store-listing)
9. [Post-Publication](#post-publication)
10. [Common Rejection Reasons](#common-rejection-reasons)

---

## Overview

Publishing to the DGOS app store makes your application available to all DGOS users. The publishing process includes:

1. **Preparation**: Code, testing, documentation
2. **Validation**: Automated checks and manual review
3. **Submission**: Upload package to store
4. **Review**: Security, quality, and compliance review
5. **Publication**: Release to selected channel
6. **Monitoring**: Track adoption and issues

---

## Pre-Publish Checklist

### Code Quality

- [ ] All tests passing (unit, integration, e2e)
- [ ] Code linting passes without errors
- [ ] No console errors or warnings in production build
- [ ] Performance budgets met
- [ ] Memory leaks checked and fixed
- [ ] Security audit passed (`npm audit`, Snyk, etc.)

### Manifest & Configuration

- [ ] Manifest validates successfully (`dgos app validate`)
- [ ] appId is correct and unique
- [ ] Version numbers updated correctly
- [ ] Build number incremented
- [ ] All required fields present
- [ ] Localization complete (zh-CN, en-US minimum)
- [ ] Permissions properly documented
- [ ] Icon meets requirements (512×512 PNG)

### Documentation

- [ ] README.md complete and up-to-date
- [ ] CHANGELOG.md updated with version changes
- [ ] LICENSE file included
- [ ] User-facing documentation complete
- [ ] Screenshots prepared (see App Store Listing)
- [ ] Release notes written

### Testing

- [ ] Tested on supported platforms
- [ ] Tested at different screen resolutions
- [ ] Tested with different themes (light/dark)
- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility verified
- [ ] Tested with various permission configurations
- [ ] Installation/uninstallation tested
- [ ] Update from previous version tested (if applicable)

### Accessibility

- [ ] WCAG 2.1 Level AA compliance verified
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels present where needed
- [ ] Color contrast ratios meet standards
- [ ] Text scaling supported up to 200%
- [ ] Focus indicators visible
- [ ] Alt text provided for images

### Security

- [ ] No hardcoded secrets or API keys
- [ ] All user input validated
- [ ] XSS protection implemented
- [ ] CSRF protection where applicable
- [ ] Content Security Policy configured
- [ ] Dependencies audited for vulnerabilities
- [ ] Sensitive data properly encrypted
- [ ] Network requests use HTTPS

### Performance

- [ ] Bundle size within limits (< 500 KB initial)
- [ ] Startup time < 2 seconds
- [ ] Initial render time < 1 second
- [ ] Time to interactive < 3.5 seconds
- [ ] Memory usage < 200 MB
- [ ] CPU usage < 10% when idle

### Legal & Compliance

- [ ] License clearly stated
- [ ] No copyright violations
- [ ] Third-party licenses documented
- [ ] Privacy policy provided (if collecting data)
- [ ] Terms of service provided (if required)
- [ ] Age rating determined
- [ ] Export compliance checked

---

## Review Criteria

### Functional Requirements

**Must Have**:
- Application launches successfully
- Core features work as documented
- No critical bugs or crashes
- Handles errors gracefully
- Responds to user input appropriately

**Rejection Reasons**:
- Application crashes on launch
- Core features don't work
- Unhandled errors crash the app
- UI becomes unresponsive

### User Experience

**Must Have**:
- Intuitive interface
- Consistent with DGOS design language
- Proper loading states
- Meaningful error messages
- Confirmation for destructive actions

**Rejection Reasons**:
- Confusing or misleading UI
- Inconsistent design patterns
- No feedback for long operations
- Cryptic error messages

### Security

**Must Have**:
- Proper permission declarations
- Input validation
- Secure data storage
- HTTPS for network requests
- No obvious security vulnerabilities

**Rejection Reasons**:
- Requests unnecessary permissions
- Security vulnerabilities present
- Stores sensitive data insecurely
- Makes insecure network requests

### Performance

**Must Have**:
- Meets performance budgets
- Responsive user interface
- Efficient resource usage
- Proper memory management

**Rejection Reasons**:
- Excessive startup time (> 3s)
- UI freezes or lags
- Memory leaks
- Excessive battery drain

### Accessibility

**Must Have**:
- WCAG 2.1 Level AA compliance
- Keyboard navigation
- Screen reader support
- Proper color contrast
- Scalable text

**Rejection Reasons**:
- Critical features not keyboard accessible
- Poor screen reader experience
- Insufficient color contrast
- Text doesn't scale

### Content

**Must Have**:
- Appropriate for all audiences (or properly rated)
- No offensive or harmful content
- No misleading information
- Proper attribution for third-party content

**Rejection Reasons**:
- Inappropriate content
- Misleading claims
- Copyright violations
- Hate speech or harassment

### Documentation

**Must Have**:
- Clear app description
- Accurate feature list
- Help documentation
- Contact information
- Privacy policy (if collecting data)

**Rejection Reasons**:
- Misleading description
- Missing required documentation
- Inaccurate feature claims

---

## Version Management

### Semantic Versioning

Follow SemVer 2.0.0:

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

**When to increment**:

**MAJOR** (1.0.0 → 2.0.0):
- Breaking API changes
- Major feature overhaul
- Data format changes (with migration)
- Removed features

**MINOR** (1.0.0 → 1.1.0):
- New features (backward compatible)
- Improvements to existing features
- New capabilities

**PATCH** (1.0.0 → 1.0.1):
- Bug fixes
- Performance improvements
- Security patches
- Minor UI tweaks

**PRERELEASE** (2.0.0-beta.1):
- Alpha, beta, release candidate
- Testing versions

### Build Numbers

- Increment with **every** build
- Separate counter for each version
- Never reuse build numbers

```json
{
  "version": "1.2.3",
  "build": 42
}
```

### Data Versions

Increment `dataVersion` when:
- Storage structure changes
- New required fields added
- Data types changed
- Breaking data changes

Provide migration scripts for data version changes:

```json
{
  "dataVersion": 2,
  "dataMigration": {
    "from": [0, 1],
    "entry": "migrations/2.json"
  }
}
```

### Version Strategy

**Development Cycle**:
```
1.0.0-alpha.1  → Early development
1.0.0-alpha.2  → More features
1.0.0-beta.1   → Feature complete, testing
1.0.0-beta.2   → Bug fixes
1.0.0-rc.1     → Release candidate
1.0.0          → Stable release
1.0.1          → Bug fix
1.1.0          → New features
```

---

## Release Channels

### Stable

**Purpose**: Production releases for all users

**Requirements**:
- Thoroughly tested
- All features complete
- Documentation complete
- No known critical bugs
- Performance validated

**Review**: Full security and quality review

**Update Frequency**: Monthly or as needed for critical fixes

**Example**:
```json
{
  "version": "1.2.0",
  "releaseChannel": "stable"
}
```

### Beta

**Purpose**: Testing releases for early adopters

**Requirements**:
- Feature complete
- Basic testing done
- Known issues documented
- May have non-critical bugs

**Review**: Standard review process

**Update Frequency**: Weekly or bi-weekly

**Example**:
```json
{
  "version": "1.3.0-beta.2",
  "releaseChannel": "beta"
}
```

### Dev

**Purpose**: Development builds for testing

**Requirements**:
- May be incomplete
- Experimental features
- May be unstable
- For testing only

**Review**: Minimal review

**Update Frequency**: Daily or continuous

**Example**:
```json
{
  "version": "1.3.0-dev.123",
  "releaseChannel": "dev"
}
```

---

## Publishing Steps

### 1. Prepare Package

```bash
# Ensure dependencies are installed
pnpm install

# Run tests
pnpm test

# Lint code
pnpm lint

# Build for production
pnpm build

# Validate manifest
dgos app validate

# Create package
dgos app package
```

This creates a `.dgos` package file:
```
my-app-1.0.0.dgos
```

### 2. Test Installation Locally

```bash
# Install package locally
dgos app install ./my-app-1.0.0.dgos --test

# Test the application
# - Launch and use all features
# - Check for errors
# - Verify permissions work
# - Test uninstall

# Uninstall test version
dgos app uninstall com.example.myapp
```

### 3. Submit to Store

```bash
# Authenticate (if not already)
dgos auth login

# Submit package
dgos app publish ./my-app-1.0.0.dgos \
  --channel stable \
  --notes "Release notes here"

# Or submit to beta channel
dgos app publish ./my-app-1.0.0.dgos \
  --channel beta \
  --notes "Beta testing version"
```

### 4. Provide Submission Information

During submission, you'll be prompted for:

- **Release notes**: Changes in this version
- **Target audience**: Who should use this app
- **Age rating**: Content rating
- **Support contact**: Email or URL for support
- **Privacy policy URL**: Required if collecting data
- **Screenshots**: At least 3, showing key features

### 5. Wait for Review

Review timeline:
- **Dev channel**: < 1 hour (automated checks only)
- **Beta channel**: 1-3 business days
- **Stable channel**: 3-7 business days

You'll receive email notifications:
- Submission received
- Review started
- Issues found (if any)
- Approved/Rejected

### 6. Address Review Feedback

If issues are found:

1. Review the feedback
2. Fix the issues
3. Update version/build number
4. Resubmit

Common issues:
- Permission explanations needed
- Performance problems
- Accessibility issues
- Documentation gaps

### 7. Publication

Once approved:
- App appears in store within 1 hour
- Users can install via store or CLI
- Analytics available in dashboard

---

## Update Process

### Updating Existing App

1. **Make Changes**
   ```bash
   # Make code changes
   # Update version in manifest
   # Update CHANGELOG.md
   # Update documentation
   ```

2. **Increment Versions**
   ```json
   {
     "version": "1.1.0",  // Increment appropriately
     "build": 43,         // Increment build
     "dataVersion": 1     // Increment if data changed
   }
   ```

3. **Test Update Path**
   ```bash
   # Install previous version
   dgos app install com.example.myapp@1.0.0
   
   # Test the app
   
   # Install new version
   dgos app install ./my-app-1.1.0.dgos
   
   # Verify:
   # - Data migrated correctly
   # - Settings preserved
   # - No errors
   ```

4. **Write Release Notes**
   ```markdown
   ## Version 1.1.0
   
   ### New Features
   - Added dark mode support
   - New export formats (CSV, JSON)
   
   ### Improvements
   - 30% faster startup time
   - Reduced memory usage
   
   ### Bug Fixes
   - Fixed crash when opening large files
   - Fixed date formatting in exports
   ```

5. **Submit Update**
   ```bash
   dgos app publish ./my-app-1.1.0.dgos \
     --channel stable \
     --notes-file RELEASE_NOTES.md
   ```

### Automatic Updates

Users receive updates based on their settings:
- **Automatic**: Updates install automatically
- **Notify**: User prompted to update
- **Manual**: User must manually update

Your app can check for updates:
```typescript
import { DGOSClient } from '@dgos/sdk';

const client = DGOSClient.current();
const updateAvailable = await client.app.checkForUpdate();

if (updateAvailable) {
  // Prompt user or install automatically
}
```

---

## App Store Listing

### Description

**Format**:
- **Short description** (80-160 characters): Used in search results
- **Long description** (500-2000 characters): Full app page

**Tips**:
- Start with key benefit
- Highlight unique features
- Use bullet points for features
- Include use cases
- Target your audience
- SEO-friendly keywords

**Example**:
```
Short: Powerful task manager to organize your work and life efficiently.

Long:
TaskMaster helps you stay organized and productive with:

• Smart task organization with tags and projects
• Due dates and reminders
• Collaboration with team members
• Calendar integration
• Offline support
• Cross-device sync

Perfect for:
- Busy professionals managing multiple projects
- Teams collaborating on tasks
- Students organizing assignments
- Anyone wanting to be more productive

Key Features:
...
```

### Screenshots

**Requirements**:
- Minimum 3 screenshots
- Maximum 8 screenshots
- PNG or JPEG format
- Recommended sizes:
  - Desktop: 1920×1080 or 1280×720
  - Tablet: 1024×768
  - Mobile: 750×1334

**Content**:
- Show key features
- Include captions (localized)
- Use actual app content (not mockups)
- Highlight unique functionality
- Show UI in action

**Order**:
1. Main interface
2. Key feature #1
3. Key feature #2
4. Settings/customization
5. Advanced features

### Categories

Choose the most appropriate category:

- **Productivity**: Task managers, notes, calendars
- **Utilities**: Tools, calculators, converters
- **Creative**: Drawing, design, media editing
- **Communication**: Chat, email, collaboration
- **Development**: IDEs, debuggers, dev tools
- **Data**: Databases, analytics, visualization
- **Education**: Learning, tutorials, references
- **Entertainment**: Games, media players
- **Finance**: Accounting, budgeting
- **Health**: Fitness, wellness, medical
- **Business**: CRM, ERP, project management

### Tags

Add 5-10 relevant tags:
```json
{
  "tags": [
    "productivity",
    "tasks",
    "organization",
    "collaboration",
    "project-management"
  ]
}
```

### Support Information

Provide:
- **Support email**: For user inquiries
- **Website**: App homepage
- **Documentation**: User guides
- **Issue tracker**: Bug reports (optional)
- **Community**: Forum or Discord (optional)

---

## Post-Publication

### Monitor Performance

Track key metrics:
- **Installs**: Daily/weekly install count
- **Active users**: Daily/monthly active users
- **Ratings**: Average rating and reviews
- **Crashes**: Crash rate and reports
- **Performance**: Startup time, memory usage

Access via:
```bash
dgos app analytics com.example.myapp
```

### Respond to Reviews

- Monitor reviews regularly
- Respond to issues promptly
- Thank users for positive feedback
- Address concerns professionally
- Fix reported bugs quickly

### Update Regularly

Maintain app with:
- Bug fixes
- Performance improvements
- New features
- Security updates
- Compatibility updates

Recommended update frequency:
- **Critical fixes**: Immediately
- **Bug fixes**: Weekly or bi-weekly
- **New features**: Monthly or quarterly
- **Major versions**: Annually

### Communicate Changes

Keep users informed:
- Write clear release notes
- Announce major updates
- Maintain changelog
- Blog about new features
- Social media updates

---

## Common Rejection Reasons

### 1. Functional Issues

**Problem**: App crashes or doesn't work
**Solution**: Thorough testing before submission

**Problem**: Features don't match description
**Solution**: Update description or add features

**Problem**: Poor error handling
**Solution**: Add proper error handling and user feedback

### 2. Permission Issues

**Problem**: Requesting unnecessary permissions
**Solution**: Only request needed permissions, document why

**Problem**: No explanation for permissions
**Solution**: Add permission explanations in manifest

**Problem**: Permissions misaligned with features
**Solution**: Review and align permissions with actual needs

### 3. Performance Issues

**Problem**: Slow startup (> 3s)
**Solution**: Optimize initialization, lazy load resources

**Problem**: High memory usage
**Solution**: Profile and fix memory leaks

**Problem**: UI lag or freezing
**Solution**: Move heavy operations off main thread

### 4. Accessibility Issues

**Problem**: Not keyboard navigable
**Solution**: Add keyboard support to all interactions

**Problem**: Poor screen reader support
**Solution**: Add ARIA labels and semantic HTML

**Problem**: Low color contrast
**Solution**: Use accessible color combinations (4.5:1 minimum)

### 5. Security Issues

**Problem**: Exposed secrets in code
**Solution**: Use environment variables, secure storage

**Problem**: Insecure network requests
**Solution**: Use HTTPS for all requests

**Problem**: XSS vulnerabilities
**Solution**: Sanitize all user input

### 6. Documentation Issues

**Problem**: Missing or incomplete docs
**Solution**: Write comprehensive documentation

**Problem**: Inaccurate feature claims
**Solution**: Update docs to match actual features

**Problem**: No privacy policy (but collecting data)
**Solution**: Add privacy policy

### 7. Content Issues

**Problem**: Inappropriate content
**Solution**: Remove or properly rate content

**Problem**: Misleading information
**Solution**: Provide accurate, honest information

**Problem**: Copyright violations
**Solution**: Use properly licensed assets

---

## Tips for Success

### Before Submission

1. **Test thoroughly** on multiple configurations
2. **Get beta testers** to find issues early
3. **Optimize performance** to meet budgets
4. **Polish UI** for professional appearance
5. **Write great docs** to help users

### During Review

1. **Respond quickly** to reviewer questions
2. **Be professional** in communications
3. **Fix issues promptly** if found
4. **Provide clarifications** when needed
5. **Be patient** - reviews take time

### After Publication

1. **Monitor feedback** and metrics
2. **Fix bugs quickly** to maintain rating
3. **Update regularly** to stay relevant
4. **Engage with users** in reviews
5. **Iterate and improve** continuously

---

## Resources

- [Development Standards](./development-standards.md)
- [Manifest Reference](./manifest-reference.md)
- [Getting Started Guide](./getting-started.md)
- [App Store Dashboard](https://store.dgos.dev/dashboard)
- [Developer Support](mailto:developer-support@dgos.dev)

---

## Checklist Summary

Use this quick checklist before publishing:

```
□ All tests passing
□ Manifest validates
□ Version numbers updated
□ Icon meets requirements
□ Documentation complete
□ Accessibility verified
□ Security audit passed
□ Performance budgets met
□ Tested on all platforms
□ Release notes written
□ Screenshots prepared
□ Legal compliance checked
□ Tested install/uninstall
□ Tested update path (if applicable)
```

---

**Version**: 1.0.0  
**Last Updated**: 2024-10-03  
**Status**: Active
