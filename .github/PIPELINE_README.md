# GitHub Actions CI/CD Pipeline

## 📋 Übersicht

Diese CI/CD Pipeline automatisiert:

- ✅ **Unit Tests** mit Vitest
- ✅ **Type Checking** mit Vue TSC
- ✅ **Linting** mit ESLint und Oxlint
- ✅ **Build** mit Vite
- ✅ **Multi-Node-Version Testing** (18.x, 20.x)

---

## 📁 Dateien

```
.github/
└── workflows/
    └── ci-cd.yml          # Main CI/CD Workflow
```

---

## 🚀 Wie es funktioniert

### Trigger Events

Die Pipeline wird automatisch ausgelöst bei:

- **Push** auf `main` oder `develop` Branches
- **Pull Requests** gegen `main` oder `develop` Branches

### Jobs

#### 1. **tests** (Tests & Quality Checks)

- Testet auf Node.js 18.x und 20.x parallel
- TypeScript Typ-Überprüfung
- ESLint Linting
- Vitest Unit Tests
- Build Prozess
- Artifact Upload

#### 2. **lint-and-format** (Code Quality)

- Oxlint Analyse
- Prettier Format-Checks

#### 3. **build** (Build & Deploy)

- Läuft nur nach erfolgreichen Tests (`needs: [tests]`)
- Baut das Projekt
- Speichert Build-Artifact

---

## ⚙️ Konfiguration

### Node.js Versionen

```yaml
matrix:
  node-version: [18.x, 20.x]
```

Ändere die Versionen in `.github/workflows/ci-cd.yml` um andere Node.js Versionen zu testen.

### Branches

In der `on:` Sektion kannst du die Branches anpassen:

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

### Artifact Retention

- Test Results: **7 Tage**
- Build Artifact: **30 Tage**

---

## 📊 Status Badge

Füge diesen Badge zu deiner `README.md` hinzu:

```markdown
[![CI/CD Pipeline](https://github.com/DEIN_USERNAME/ti-tutor/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/DEIN_USERNAME/ti-tutor/actions)
```

---

## 🧪 Test Suite

### App Component Tests (`App.spec.ts`)

- Rendering Tests
- Layout Tests
- Header Tests
- Navigation Tests

### Automaton Simulator Tests (`automatonSimulator.spec.ts`)

- DFA Simulation Tests
- NFA Simulation Tests
- Error Handling Tests
- Test Runner Tests

---

## 📝 Scripts

Diese Scripts werden von der Pipeline ausgeführt:

```bash
# Type Checking
npm run type-check

# Linting
npm run lint:eslint
npm run lint:oxlint

# Unit Tests
npm run test:unit

# Build
npm run build

# Format
npm run format
```

---

## 🔧 Lokales Testen

Vor dem Push kannst du lokal testen:

```bash
# Alle Tests ausführen
npm run test:unit

# Type Check
npm run type-check

# Linting
npm run lint

# Build
npm run build
```

---

## 📌 Wichtige Hinweise

1. **GitHub Repository linked?**
   - Stelle sicher, dass dein lokales Git-Repo mit dem GitHub Repo verbunden ist
   - Überprüfe mit: `git remote -v`

2. **.github/workflows/ Ordner**
   - Muss sich im Root des Repositories befinden
   - Nicht in src/ oder andere Ordner!

3. **Branch Protect Rules** (Optional)
   - Gehe zu GitHub → Settings → Branches → Add Rule
   - Verlange, dass die CI/CD Pipeline erfolgreich ist vor dem Merge

4. **GitHub Actions aktivieren?**
   - Gehe zu: Settings → Actions → General
   - Stelle sicher "Actions" ist aktiviert

---

## 🚀 Erste Schritte

1. **Commit und Push:**

```bash
git add .github/
git add src/__tests__/
git commit -m "🔄 Setup GitHub Actions CI/CD Pipeline"
git push origin main
```

2. **Überprüfe Status:**
   - Gehe zu GitHub → Actions
   - Du solltest die Pipeline sehen und wie sie läuft

3. **Überprüfe Logs:**
   - Klick auf den Workflow Run
   - Schau die Logs für jeden Job an

---

## 💡 Anpassungen

### Nur auf main Branch

Wenn du nur PR/Push auf main überprüfen willst:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

### Schedules (Optional)

Tägliche Tests um 2 AM:

```yaml
schedule:
  - cron: '0 2 * * *'
```

### Deployment

Um automatisch zu deployen nach erfolgreichen Tests, füge einen Job hinzu

---

## 📞 Hilfe

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Vitest Docs](https://vitest.dev/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
