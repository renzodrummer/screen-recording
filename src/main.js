import { app, BrowserWindow, dialog, desktopCapturer, ipcMain } from "electron";
const path = require("path");
const fs = require("fs");

if (require("electron-squirrel-startup")) {
    app.quit();
}

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

    mainWindow.webContents.openDevTools();
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle("getSources", async () => {
    return await desktopCapturer.getSources({ types: ["window", "screen"] });
});

ipcMain.handle("getOperatingSystem", () => {
    return process.platform;
});

let writeStream = null;
let tempFilePath = null;

ipcMain.handle("startRecording", () => {
    tempFilePath = path.join(
        app.getPath("temp"),
        `temp-record-${Date.now()}.webm`,
    );

    writeStream = fs.createWriteStream(tempFilePath);
    return true;
});

ipcMain.on("saveChunk", (event, arrayBuffer) => {
    if (writeStream) {
        writeStream.write(Buffer.from(arrayBuffer));
    }
});

ipcMain.handle("stopRecordingAndSave", async () => {
    if (writeStream) {
        writeStream.end();
        writeStream = null;
    }

    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
        return false;
    }

    const { canceled, filePath } = await dialog.showSaveDialog({
        buttonLabel: "Save video",
        defaultPath: `vid-${Date.now()}.webm`,
    });

    if (!canceled && filePath) {
        fs.copyFileSync(tempFilePath, filePath);
        fs.unlinkSync(tempFilePath);
        tempFilePath = null;
        return true;
    } else {
        fs.unlinkSync(tempFilePath);
        tempFilePath = null;
        return false;
    }
});
