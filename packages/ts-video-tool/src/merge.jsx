import React from "react";
import { Button, Table, Input, message, Modal, Spin } from "antd";
import {
  DiffOutlined,
  PlusOutlined,
  FullscreenExitOutlined,
  SortDescendingOutlined,
  GithubOutlined,
  FolderAddOutlined,
  SyncOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import { ipcRenderer, remote, shell } from "electron";
import lpFileNameSort from "lp-file-name-sort/dist/index.esm.js";
import "./merge.less";

const SUPORT_INPUT_EXT = ["ts", "mp4", "mov", "avi", "mkv"];

export default class Merge extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showDropMask: false,
      fileList: [],
      cliContent: "控制台信息：\n",
      convertingFiles: [], // 转换中的文件
      convertFiles: [], // 所有需要转换的文件
      loading: false,
    };
  }

  handleAddBtnClick() {
    remote.dialog
      .showOpenDialog({
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "视频格式", extensions: SUPORT_INPUT_EXT }],
      })
      .then((result) => {
        if (!result.filePaths.length) {
          return;
        }
        this.setState({
          fileList: result.filePaths.map((item, key) => ({
            name: item,
            num: key + 1,
            key: item,
          })),
        });
      });
  }

  handleMegeBtnClick() {
    const { fileList } = this.state;

    if (!fileList.length) {
      message.warning("还没有添加文件~", 1);
      return;
    }

    remote.dialog
      .showSaveDialog({
        title: "保存",
        defaultPath: "合并影片",
        filters: [
          { name: "MP4", extensions: ["mp4"] },
          { name: "MKV", extensions: ["mkv"] },
          { name: "TS", extensions: ["TS"] },
        ],
      })
      .then((result) => {
        if (result.filePath) {
          this.setState({
            cliContent: "控制台信息：\n",
          });
          ipcRenderer.send("merge-merge", {
            input: fileList.map((item) => item.name).join("|"),
            output: result.filePath,
          });
        }
      });
  }

  handleFileSort() {
    this.setState({
      fileList: this.state.fileList
        .sort((a, b) => lpFileNameSort(a.name, b.name))
        .map((item, key) => ({
          ...item,
          num: key + 1,
        })),
    });
  }

  handleDropLeave(e) {
    e.preventDefault();
    e.stopPropagation();

    !this.state.showDropMask ||
      this.setState({
        showDropMask: false,
      });
  }

  handleBtnGithub() {
    shell.openExternal("https://github.com/claude-hub/electron-apps");
  }

  handleConvert = () => {
    const { convertingFiles } = this.state;
    if (convertingFiles.length > 0) {
      const first = convertingFiles.shift();
      this.setState({
        convertingFiles: [...convertingFiles]
      })
      ipcRenderer.send("merge-merge", {
        input: first,
        output: first.replace('.ts', '.mp4'),
      });
    } else {
      this.setState({
        loading: false
      })
    }
  }

  componentDidMount() {
    window.addEventListener(
      "dragenter",
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        this.state.showDropMask ||
          this.setState({
            showDropMask: true,
          });
      },
      false
    );
    window.addEventListener(
      "dragover",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      false
    );
    window.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();

      this.setState({
        showDropMask: false,
      });

      const dropfiles = [];

      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        let item = e.dataTransfer.items[i];
        if (item.kind === "file") {
          let filename = item.getAsFile().name;
          let ext = filename.substr(filename.lastIndexOf(".") + 1);
          SUPORT_INPUT_EXT.includes(ext) && dropfiles.push(item.getAsFile());
        }
      }
      dropfiles.length &&
        this.setState({
          fileList: dropfiles.map((item, key) => ({
            name: item.path,
            num: key + 1,
          })),
        });
    });

    ipcRenderer.on("merge-merge-result", (_, arg) => {
      if (arg.type == "err") {
        Modal.error({
          title: "错误",
          content: (
            <div>
              当前系统未安装ffmpeg，请在终端中执行：“brew install ffmpeg”
              进行安装~
            </div>
          ),
        });
      }

      if (arg.data.indexOf("muxing overhead") > -1) {
        this.setState(
          {
            cliContent: this.state.cliContent + arg.file + "\n",
          },
          () => {
            if (this.refConsole) {
              this.refConsole.scrollTop = this.refConsole.scrollHeight;
            }
          }
        );
        ipcRenderer.send("delete-file", {
          file: arg.file
        });
      }
    });

    ipcRenderer.on("convert-files", (_, { data }) => {
      this.setState({
        convertFiles: [...data],
        convertingFiles: [...data],
      })
    })

    ipcRenderer.on("delete-file-response", (event, arg) => {
      const { type, err, file } = arg;
      if (type === 'success') {
        // 上一个转存成功后，继续往下面转存
        this.handleConvert();
      } else {
        this.setState({
          cliContent: this.state.cliContent + file + err + ' 文件删除失败，暂停继续转换' + "\n"
        })
      }
    })
  }

  handleTsToMp4 = () => {
    remote.dialog
      .showOpenDialog({
        name: 'Movies',
        properties: ['openDirectory'],
        filters: [{ name: "视频格式", extensions: SUPORT_INPUT_EXT }],
      })
      .then((result) => {
        if (result.filePaths && result.filePaths.length === 1) {
          const [folder] = result.filePaths;
          ipcRenderer.send("start-convert", {
            folder
          });
        }
      });
  }

  render() {
    const { showDropMask, fileList, cliContent, convertFiles, loading } = this.state;
    return (
      <div className="Merge">
        {showDropMask && (
          <div
            className="Merge-drop"
            onDragLeave={(e) => this.handleDropLeave(e)}
          >
            <DiffOutlined style={{ fontSize: 150 }} />
            <div>添加文件</div>
          </div>
        )}
        <div className="Merge-actions">
          <div className="Merge-btns">
            <Button
              type="primary"
              ghost
              icon={<PlusOutlined />}
              onClick={() => this.handleAddBtnClick()}
            >
              添加文件
            </Button>
            <Button
              type="primary"
              ghost
              icon={<SortDescendingOutlined />}
              onClick={() => this.handleFileSort()}
            >
              排序
            </Button>
            <Button
              type="primary"
              ghost
              icon={<FullscreenExitOutlined />}
              onClick={() => this.handleMegeBtnClick()}
            >
              合并
            </Button>
          </div>

          <div className="Merge-folder">
            <div>批量处理，TS视频一键转MP4 &nbsp;</div>
            <Button
              ghost
              type="primary"
              onClick={this.handleTsToMp4}
              icon={<FolderAddOutlined />}
            >
              选择文件夹
            </Button>
          </div>
          <div className="Merge-github" onClick={() => this.handleBtnGithub()}>
            <GithubOutlined title="访问Github" />
          </div>
        </div>
        {convertFiles.length > 0 && (
          <div className="file-wrapper Merge-btns">
            <Spin spinning={loading}>
              <Button
                ghost
                type="primary"
                icon={<SyncOutlined />}
                onClick={() =>
                  this.setState({
                    loading: true
                  }, () => this.handleConvert())
                }
              >
                开始转存
              </Button>
              <Button
                ghost
                type="primary"
                icon={<ClearOutlined />}
                onClick={() => this.setState({
                  convertFiles: [],
                  convertingFiles: [],
                  cliContent: '控制台信息：\n'
                })}
              >
                清空列表
              </Button>
            </Spin>
            <div className="file-list">
              {
                convertFiles.map(item => {
                  return <div key={item}>{item}</div>
                })
              }
            </div>
          </div>
        )}

        {fileList.length > 0 && (
          <div>
            <Table
              dataSource={fileList}
              columns={[
                {
                  title: "",
                  dataIndex: "num",
                  width: 50,
                },
                {
                  title: "文件列表",
                  dataIndex: "name",
                },
              ]}
              size="small"
              pagination={false}
              scroll={{ y: 240 }}
              locale={{
                emptyText: "还没有添加文件~",
              }}
            ></Table>
          </div>
        )}
        {(fileList.length && (
          <div className="Merge-file-len">共{fileList.length}个文件</div>
        )) ||
          ""}
        <div className="Merge-console">
          <Input.TextArea
            readOnly
            rows={8}
            value={cliContent}
            ref={(_ref) => (this.refConsole = _ref)}
          />
        </div>
      </div>
    );
  }
}
