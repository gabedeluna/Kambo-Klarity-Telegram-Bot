# Contributing to Kambo Klarity Telegram Bot

Thank you for considering contributing to the Kambo Klarity Telegram Bot project! This document outlines the process for contributing and the conventions we follow.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue in our GitHub repository with:

1. A clear, descriptive title
2. A detailed description of the bug
3. Steps to reproduce the behavior
4. Expected behavior
5. Screenshots if applicable
6. Environment details (OS, Node version, etc.)

### Suggesting Enhancements

Enhancement suggestions are welcome! Create an issue with:

1. A clear, descriptive title
2. A detailed description of the suggested enhancement
3. Any relevant examples or mockups

### Pull Requests

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes following our commit message conventions
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Process

### Branching Strategy

We follow a Git Flow branching strategy:

- `main`: Production-ready code
- `develop`: Main development branch, all feature branches merge here
- `feature/XX-feature-name`: New features (branch from `develop`)
- `bugfix/XX-description`: Bug fixes (branch from `develop`)
- `release/X.X.X`: Release candidates (branch from `develop`)
- `hotfix/XX-description`: Critical production fixes (branch from `main`)

### Workflow Example

```bash
# Create a feature branch from develop
git checkout develop
git pull
git checkout -b feature/PH6-XX-feature-name

# Make changes, commit, and push
git add .
git commit -m "feat(PH6-XX): Implement feature"
git push -u origin feature/PH6-XX-feature-name

# Create a pull request to develop
```

### Commit Message Convention

We follow a simplified version of Conventional Commits:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

Format: `type(scope): description`

Example: `feat(booking): Implement calendar slot selection`

## Testing Guidelines

### Test Structure

- Tests should be organized in the same structure as the source code
- File naming: `*.test.js` or `*.spec.js`
- Keep tests simple, focused, and independent

### Test Coverage

- Aim for at least 80% code coverage
- All new features should include tests
- Bug fixes should include tests that verify the fix

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch
```

## Code Style

We use ESLint and Prettier to enforce consistent code style. Before submitting a PR:

```bash
# Check for linting errors
npm run lint

# Fix formatting issues
npm run format
```

## Documentation

- Keep README.md up to date
- Add JSDoc comments to functions and classes
- Document complex logic inline
- Update CLAUDE.md with any new development workflows

## Questions?

If you have any questions or need clarification, please open an issue with the label "question" or contact the project maintainers.

Thank you for contributing to the Kambo Klarity Telegram Bot!