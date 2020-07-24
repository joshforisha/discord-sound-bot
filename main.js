const path = require("path");
const url = require("url");
const { BrowserWindow, app } = require("electron");

let window = null;

function createWindow() {
  window = new BrowserWindow({ height: 800, width: 800 });
  // window.webContents.openDevTools();

  const startUrl = url.format({
    pathname: path.join(__dirname, "./dist/index.html"),
    protocol: "file:",
    slashes: true,
  });
  window.loadURL(startUrl);

  window.on("closed", () => {
    window = null;
  });
}

app.on("activate", () => {
  if (window === null) {
    createWindow();
  }
});

app.on("ready", () => {
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
