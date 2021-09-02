const { ipcMain, app } = require("electron");
const spawn = require("cross-spawn");
const child_process = require("child_process");
const { MERGE_CONFIG_TOOL_PATH } = require("./const");
const os = require("os");
const fs = require("fs");
const join = require('path').join;

let lastChildProcess;


const getJsonFiles = (jsonPath) => {
  let jsonFiles = [];

  function findJsonFile(path) {
    let files = fs.readdirSync(path);
    files.forEach(function (item, index) {
      let fPath = join(path, item);
      let stat = fs.statSync(fPath);
      if (stat.isDirectory() === true) {
        findJsonFile(fPath);
      }
      if (stat.isFile() === true && item !== '.DS_Store' && item.endsWith('.ts')) {
        jsonFiles.push(fPath);
      }
    });
  }
  findJsonFile(jsonPath);
  return jsonFiles;
}

const initIPC = () => {
  ipcMain.on("merge-merge", (event, arg) => {
    if (lastChildProcess) {
      lastChildProcess.kill();
      lastChildProcess = null;
    }

    let cmd = "ffmpeg";
    let env = {
      ...process.env,
      PATH: "/usr/local/bin:" + child_process.execSync("echo $PATH").toString(),
    };

    if (os.platform() == "win32") {
      cmd = MERGE_CONFIG_TOOL_PATH;
    }

    lastChildProcess = spawn(
      cmd,
      ["-y", "-i", `concat:${arg.input}`, "-c", "copy", arg.output],
      {
        env: env,
      }
    );

    lastChildProcess.stdout.on("data", (data) => {
      event.reply("merge-merge-result", {
        type: "stdout",
        data: data.toString(),
        file: arg.input
      });
    });
    lastChildProcess.stderr.on("data", (data) => {
      event.reply("merge-merge-result", {
        type: "stderr",
        data: data.toString(),
        file: arg.input
      });
    });
    lastChildProcess.on("error", (data) => {
      event.reply("merge-merge-result", {
        type: "err",
        data: data.toString(),
        file: arg.input
      });
    });
  });


  ipcMain.on("start-convert", (event, arg) => {
    const files = getJsonFiles(arg.folder);
    event.reply("convert-files", {
      data: files,
    });
  })

  ipcMain.on("delete-file", (event, arg) => {
    const { file } = arg;
    try {
      fs.unlinkSync(file);
      event.reply("delete-file-response", {
        type: 'success'
      });
    } catch(err) {
      event.reply("delete-file-response", {
        type: 'error',
        err,
        file,
      });
    }
  })

  app.on("before-quit", () => {
    lastChildProcess && lastChildProcess.kill();
  });
};
module.exports = initIPC;
