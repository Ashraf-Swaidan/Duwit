import fs from "node:fs"
import path from "node:path"

const projectRoot = process.cwd()
const releaseDir = path.join(projectRoot, "release")
const downloadsDir = path.join(projectRoot, "public", "downloads")

if (!fs.existsSync(releaseDir)) {
  throw new Error("release directory not found. Run `npm run dist:win` first.")
}

const setupCandidates = fs
  .readdirSync(releaseDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => name.endsWith(".exe") && /setup/i.test(name))
  .map((name) => {
    const fullPath = path.join(releaseDir, name)
    return { name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }
  })
  .sort((a, b) => b.mtimeMs - a.mtimeMs)

if (setupCandidates.length === 0) {
  throw new Error("No setup .exe found in release directory.")
}

const latestInstaller = setupCandidates[0]
const outputFilename = "Duwit-Setup-latest.exe"
const outputPath = path.join(downloadsDir, outputFilename)

fs.mkdirSync(downloadsDir, { recursive: true })
fs.copyFileSync(latestInstaller.fullPath, outputPath)

console.log(`Copied ${latestInstaller.name} -> public/downloads/${outputFilename}`)
