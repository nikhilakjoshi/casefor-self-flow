import * as fs from "fs";
import * as path from "path";

function getTimestamp(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${month}${day}${year}_${hours}${minutes}`;
}

function archivePrd(): void {
  const timestamp = getTimestamp();
  const archiveDir = path.join(__dirname, "prd", "archive");

  // Ensure archive directory exists
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const filesToArchive = [
    {
      src: path.join(__dirname, "plans", "prd.md"),
      ext: "md",
      emptyContent: "",
    },
    {
      src: path.join(__dirname, "plans", "prd.json"),
      ext: "json",
      emptyContent: "[]",
    },
  ];

  for (const file of filesToArchive) {
    if (fs.existsSync(file.src)) {
      const destPath = path.join(archiveDir, `prd-${timestamp}.${file.ext}`);
      // Copy to archive
      fs.copyFileSync(file.src, destPath);
      console.log(`Archived: ${file.src} -> ${destPath}`);
      // Empty the original file
      fs.writeFileSync(file.src, file.emptyContent);
      console.log(`Emptied: ${file.src}`);
    } else {
      console.warn(`File not found, skipping: ${file.src}`);
    }
  }

  console.log("Archive complete!");
}

archivePrd();
