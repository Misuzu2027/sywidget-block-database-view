import fs from 'fs';
import http from 'node:http';
import readline  from 'node:readline';


//************************************ Write you dir here ************************************

//Please write the "workspace/data/widgets" directory here
//请在这里填写你的 "workspace/data/widgets" 目录
let targetDir = '';
//Like this
// let targetDir = `H:\\SiYuanDevSpace\\data\\widgets`;
//********************************************************************************************

const log = (info) => console.log(`\x1B[36m%s\x1B[0m`, info);
const error = (info) => console.log(`\x1B[31m%s\x1B[0m`, info);

let POST_HEADER = {
    // "Authorization": `Token ${token}`,
    "Content-Type": "application/json",
}

async function myfetch(url, options) {
    //使用 http 模块，从而兼容那些不支持 fetch 的 nodejs 版本
    return new Promise((resolve, reject) => {
        let req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    ok: true,
                    status: res.statusCode,
                    json: () => JSON.parse(data)
                });
            });
        });
        req.on('error', (e) => {
            reject(e);
        });
        req.end();
    });
}

async function getSiYuanDir() {
    let url = 'http://127.0.0.1:6806/api/system/getWorkspaces';
    let conf = {};
    try {
        let response = await myfetch(url, {
            method: 'POST',
            headers: POST_HEADER
        });
        if (response.ok) {
            conf = await response.json();
        } else {
            error(`\tHTTP-Error: ${response.status}`);
            return null;
        }
    } catch (e) {
        error(`\tError: ${e}`);
        error("\tPlease make sure SiYuan is running!!!");
        return null;
    }
    return conf.data;
}

async function chooseTarget(workspaces) {
    let count = workspaces.length;
    log(`>>> Got ${count} SiYuan ${count > 1 ? 'workspaces' : 'workspace'}`)
    for (let i = 0; i < workspaces.length; i++) {
        log(`\t[${i}] ${workspaces[i].path}`);
    }

    if (count == 1) {
        return `${workspaces[0].path}/data/widgets`;
    } else {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        let index = await new Promise((resolve, reject) => {
            rl.question(`\tPlease select a workspace[0-${count-1}]: `, (answer) => {
                resolve(answer);
            });
        });
        rl.close();
        return `${workspaces[index].path}/data/widgets`;
    }
}

log('>>> Try to visit constant "targetDir" in make_dev_link.js...')

if (targetDir === '') {
    log('>>> Constant "targetDir" is empty, try to get SiYuan directory automatically....')
    let res = await getSiYuanDir();
    
    if (res === null || res === undefined || res.length === 0) {
        log('>>> Can not get SiYuan directory automatically, try to visit environment variable "SIYUAN_PLUGIN_DIR"....');

        // console.log(process.env)
        let env = process.env?.SIYUAN_PLUGIN_DIR;
        if (env !== undefined && env !== null && env !== '') {
            targetDir = env;
            log(`\tGot target directory from environment variable "SIYUAN_PLUGIN_DIR": ${targetDir}`);
        } else {
            error('\tCan not get SiYuan directory from environment variable "SIYUAN_PLUGIN_DIR", failed!');
            process.exit(1);
        }
    } else {
        targetDir = await chooseTarget(res);
    }


    log(`>>> Successfully got target directory: ${targetDir}`);
}

//Check
if (!fs.existsSync(targetDir)) {
    error(`Failed! plugin directory not exists: "${targetDir}"`);
    error(`Please set the plugin directory in scripts/make_dev_link.js`);
    process.exit(1);
}


//check if widget.json exists
if (!fs.existsSync('./widget.json')) {
    //change dir to parent
    process.chdir('../');
    if (!fs.existsSync('./widget.json')) {
        error('Failed! widget.json not found');
        process.exit(1);
    }
}

//load widget.json
const plugin = JSON.parse(fs.readFileSync('./widget.json', 'utf8'));
const name = plugin?.name;
if (!name || name === '') {
    error('Failed! Please set plugin name in widget.json');
    process.exit(1);
}

//dev directory
const devDir = `${process.cwd()}/dev`;
//mkdir if not exists
if (!fs.existsSync(devDir)) {
    fs.mkdirSync(devDir);
}

function cmpPath(path1, path2) {
    path1 = path1.replace(/\\/g, '/');
    path2 = path2.replace(/\\/g, '/');
    // sepertor at tail
    if (path1[path1.length - 1] !== '/') {
        path1 += '/';
    }
    if (path2[path2.length - 1] !== '/') {
        path2 += '/';
    }
    return path1 === path2;
}

const targetPath = `${targetDir}/${name}`;
//如果已经存在，就退出
if (fs.existsSync(targetPath)) {
    let isSymbol = fs.lstatSync(targetPath).isSymbolicLink();

    if (isSymbol) {
        let srcPath = fs.readlinkSync(targetPath);
        
        if (cmpPath(srcPath, devDir)) {
            log(`Good! ${targetPath} is already linked to ${devDir}`);
        } else {
            error(`Error! Already exists symbolic link ${targetPath}\nBut it links to ${srcPath}`);
        }
    } else {
        error(`Failed! ${targetPath} already exists and is not a symbolic link`);
    }

} else {
    //创建软链接
    fs.symlinkSync(devDir, targetPath, 'junction');
    log(`Done! Created symlink ${targetPath}`);
}

