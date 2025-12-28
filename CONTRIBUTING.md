# Contributing to Soundboard

Thank you for considering contributing to this project! This document provides guidelines for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Soundboard.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test thoroughly
6. Commit with clear messages: `git commit -m "Add feature: description"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

```bash
npm install
npm start  # Run in development mode
```

## Code Standards

- Use consistent indentation (2 spaces)
- Write clear, descriptive variable and function names
- Comment complex logic
- Test your changes before submitting

## What to Contribute

### Bug Fixes
- Check existing issues first
- Provide clear reproduction steps
- Include relevant logs or screenshots

### New Features
- Open an issue to discuss before implementing major features
- Ensure features align with project goals
- Update documentation as needed

### Documentation
- Fix typos or clarify unclear sections
- Add examples for complex features
- Keep language concise and clear

## Pull Request Guidelines

- **Title**: Clear and descriptive (e.g., "Fix hotkey conflict resolution")
- **Description**: Explain what and why, not just how
- **Testing**: Describe how you tested your changes
- **Breaking Changes**: Clearly document any breaking changes

## Project Structure

- `src/main/` - Electron main process (hardware integration, file I/O)
- `src/renderer/` - UI logic and rendering
- `src/common/` - Shared utilities and configuration
- `docs/` - Documentation files
- `assets/` - Icons and static resources

## Commit Message Format

Use clear, imperative mood commit messages:

```
Add feature: Stream Deck rotation support
Fix: Hotkey conflict resolution bug
Update: Simplify grid navigation logic
Docs: Add ARCHITECTURE.md
```

## Testing

Before submitting:
- Test audio playback with various file formats
- Verify hotkeys work correctly
- Test Stream Deck integration if applicable
- Check that navigation between grids works
- Ensure no console errors

## Questions?

Open an issue or discussion on GitHub if you have questions about contributing.

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on the issue, not the person
- Assume good intentions

Thank you for contributing! 🎵
