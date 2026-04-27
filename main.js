console.log("main.js chargé");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const https = require("https");
const unzipper = require("unzipper");
const { file } = require("jszip");

const userDataPath = app.getPath("userData");
const dataPath = path.join(userDataPath, "data");
// fichiers
const progressPath = path.join(userDataPath,"progress", "progress.json");
const arbresPath = path.join(dataPath, "arbres");
const indexPath = path.join(dataPath, "index.json");

const { autoUpdater } = require("electron-updater");

function createWindow() {
    const win = new BrowserWindow({
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    win.maximize();
    win.loadFile("static/html/accueil.html"); // 👈 TON POINT D’ENTRÉE
    //win.webContents.openDevTools();
}
function initUserData() {
    // 1. dossiers de base
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
    }
    if (!fs.existsSync(arbresPath)) {
        fs.mkdirSync(arbresPath, { recursive: true });
    }
    // 2. progress
    if (!fs.existsSync(progressPath)) {
        fs.writeFileSync(progressPath, JSON.stringify({ arbres: {} }, null, 2));
    }
    // 3. index global
    let index = { arbres: [], creations: [] };

    if (fs.existsSync(indexPath)) {
        index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    }
    // 4. injection default-data
    const defaultPath = path.join(__dirname, "default-data", "arbres");
    if (fs.existsSync(defaultPath)) {
        const defaultTrees = fs.readdirSync(defaultPath);
        for (const entry of defaultTrees) {
            if (!entry.isDirectory()) continue;
            const treeId=entry.name;
            const src = path.join(defaultPath, treeId);
            const dest = path.join(arbresPath, treeId);
            // 🔹 copie seulement si absent
            if (!fs.existsSync(dest)) {
                fs.cpSync(src, dest, { recursive: true });
            }
            // 🔹 ajout dans index.arbres SI absent
            const exists = index.arbres.some(a => a.id === treeId);
            if (!exists) {
                index.arbres.push({
                    id: treeId,
                    title: treeId,
                    folder: treeId,
                    root: "root"
                });
            }
        }
    }
    // 5. sauvegarde index
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}
app.whenReady().then(() => {
    initUserData();
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
});
// save progress
ipcMain.handle("save-progress", (event, progress)=>{
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
});
ipcMain.handle("save-index", (event, index)=>{
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
});
// load progress
ipcMain.handle("load-progress", () => {
    try {
        if(fs.existsSync(progressPath)){
            const raw = fs.readFileSync(progressPath, "utf-8");
            if(!raw || raw.trim() === ""){
                return { arbres: {} };
            }
            return JSON.parse(raw);
        }
        return { arbres: {} };
    } catch (e) {
        console.error("Erreur lecture progress.json :", e);
        return { arbres: {} };
    }
});
// save node
ipcMain.handle("save-node", async (event, node, arbreId) => {
    const filePath = path.join(arbresPath, arbreId, "nodes", node.id + ".json")
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(node, null, 2));
});
// open external
ipcMain.handle("open-external", async (event, url) => {
    shell.openExternal(url);
});
// export test
ipcMain.handle("export-test", async (event, folder) => {
    console.log("EXPORT TEST :", folder);
});
ipcMain.handle("export-zip", async (event, folder) => {
    const outputPath = path.join(
        require("electron").app.getPath("downloads"),
        folder + ".zip"
    );
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver("zip", { zlib: { level: 9 } });
        output.on("close", () => {
            console.log("ZIP créé :", outputPath);
            resolve(outputPath);
        });
        archive.on("error", reject);
        archive.pipe(output);
        // 🔥 IMPORTANT : dossier racine = folder
        archive.directory(
            path.join(arbresPath, folder),
            folder
        );
        archive.finalize();
    });
});

ipcMain.handle("create-tree", async (event, id, name) => {
    const basePath = path.join(arbresPath, id);
    const nodesPath = path.join(basePath, "nodes");
    // 🔹 sécurité
    fs.mkdirSync(basePath, { recursive: true });
    fs.mkdirSync(nodesPath, { recursive: true });
    // 🔹 root node
    const rootNode = {
        id: "root",
        title: "Racine",
        stack: [],
        blocks: {},
        suivant: null,
        validite: false
    };
    fs.writeFileSync(
        path.join(nodesPath, "root.json"),
        JSON.stringify(rootNode, null, 2)
    );
    // 🔹 index arbre
    const arbreIndex = {
        id: id,
        title: name,
        root: "root",
        node_count: 1,
        noeuds: ["root"]
    };
    fs.writeFileSync(
        path.join(basePath, "index.json"),
        JSON.stringify(arbreIndex, null, 2)
    );
    // 🔹 index global
    let data = { arbres: [], creations: [] };
    if (fs.existsSync(indexPath)) {
        data = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    }
    if (!data.creations) data.creations = [];
    if (!data.arbres) data.arbres = [];
    data.creations.push({
        id: id,
        title: name,
        folder: id,
        root: "root"
    });
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2));
});
ipcMain.handle("download-install", async (event, url, folder) => {
    let index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    index = cleanIndex(index);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    const alreadyInstalled = [
        ...(index.arbres || []),
        ...(index.creations || [])
    ].some(a => a.id === folder);
    if (!/^[a-zA-Z0-9_-]+$/.test(folder)) {
        throw new Error("Nom de dossier invalide");
    }
    if (alreadyInstalled) {
        throw new Error("Arbre déjà installé");
    }
    const zipPath = path.join(app.getPath("downloads"), folder + ".zip");
    const extractPath = path.join(arbresPath, folder);
    if (fs.existsSync(extractPath)) {
        throw new Error("Dossier déjà existant");
    }
    // 📦 1. Récupérer le ZIP
    if (!url.startsWith("http")) {
        console.log("ZIP LOCAL");
        const localPath = path.join(__dirname, url);
        await fs.createReadStream(localPath).pipe(unzipper.Extract({ path: extractPath })).promise();
    } else {
        console.log("ZIP DISTANT");
        await new Promise((resolve, reject) => {
            const file = fs.createWriteStream(zipPath);
            https.get(url, response => {
                response.pipe(file);
                file.on("finish", () => {file.close(resolve);});
            }).on("error", reject);
        });
        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: extractPath }))
            .promise();
    }
    // 📂 2. Vérification structure
    const innerPath = path.join(extractPath, folder);
    if (!fs.existsSync(innerPath)) {
        fs.rmSync(extractPath, { recursive: true, force: true });
        throw new Error("Structure invalide (dossier racine manquant)");
    }
    const indexFile = path.join(innerPath, "index.json");
    if (!fs.existsSync(indexFile)) {
        fs.rmSync(extractPath, { recursive: true, force: true });
        throw new Error("Archive invalide (index.json manquant)");
    }
    const parsed = JSON.parse(fs.readFileSync(indexFile, "utf-8"));
    if (!parsed.noeuds || !Array.isArray(parsed.noeuds)) {
        throw new Error("Index invalide");
    }
    // 🔁 3. Flatten dossier
    fs.cpSync(innerPath, extractPath, { recursive: true });
    fs.rmSync(innerPath, { recursive: true, force: true });
    return true;
});
ipcMain.handle("delete-arbre", async (event, arbreId) => {
    let index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    index = cleanIndex(index);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    // 🔍 trouver l’arbre
    let arbre = null;

    arbre = (index.creations || []).find(a => a.id === arbreId)
         || (index.arbres || []).find(a => a.id === arbreId);

    if(!arbre){
        throw new Error("Arbre introuvable");
    }

    const folderPath = path.join(arbresPath, arbre.folder);
    // 🗑️ 1. supprimer dossier
    if(fs.existsSync(folderPath)){
        fs.rmSync(folderPath, { recursive: true, force: true });
    }
    // 🧹 2. nettoyer index
    index.creations = (index.creations || []).filter(a => a.id !== arbreId);
    index.arbres = (index.arbres || []).filter(a => a.id !== arbreId);
    // 💾 3. sauvegarder
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    return true;
});
function cleanIndex(index){
    const seen = new Set();

    index.arbres = (index.arbres || []).filter(a => {
        if(seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
    });

    index.creations = (index.creations || []).filter(a => {
        if(seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
    });
    return index;
}
ipcMain.handle("duplicate-arbre", async (event, arbreId) => {
    const basePath = arbresPath

    let index = JSON.parse(fs.readFileSync(indexPath));

    const arbre = [...(index.arbres || []), ...(index.creations || [])]
        .find(a => a.id === arbreId);

    if(!arbre){
        throw new Error("Arbre introuvable");
    }
    // 🔹 nouveau id
    const newId = arbre.id + "_copy_" + Date.now();
    const newFolder = newId;

    const src = path.join(basePath, arbre.folder);
    const dest = path.join(basePath, newFolder);
    // 🔹 copie dossier
    fs.cpSync(src, dest, { recursive: true });
    // 🔹 ajouter dans creations
    if(!index.creations) index.creations = [];

    index.creations.push({
        id: newId,
        title: arbre.title + " (copie)",
        folder: newFolder,
        root:arbre.root
    });
    // 🔹 clean
    index = cleanIndex(index);

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    return true;
});
ipcMain.handle("load-node", async (event, arbreId, nodeId) => {
    //console.log(arbreId,nodeId);
    const filePath = path.join(arbresPath, arbreId, "nodes", nodeId + ".json");
    if(!fs.existsSync(filePath)){
        throw new Error("Node introuvable");
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
});
ipcMain.handle("load-index", () => {
    console.log("LOAD INDEX PATH:", indexPath);
    try {
        if (fs.existsSync(indexPath)) {
            const raw = fs.readFileSync(indexPath, "utf-8");
            //console.log("RAW INDEX:", raw);

            if (!raw || raw.trim() === "") {
                console.log("INDEX VIDE");
                return { arbres: [], creations: [] };
            }
            return JSON.parse(raw);
        }
        console.log("INDEX N'EXISTE PAS");
        return { arbres: [], creations: [] };
    } catch (e) {
        console.error("Erreur load index:", e);
        return { arbres: [], creations: [] };
    }
});
ipcMain.handle("get-all-nodes", async (event, arbreId) => {
    const filePath = path.join(arbresPath, arbreId,"index.json");
    if(!fs.existsSync(filePath)){
        throw new Error("Node introuvable");
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
});
ipcMain.handle("rename-node-file", async (event, arbreId, oldId, newId) => {
    if (oldId==="root") return;
    const oldPath = path.join(arbresPath, arbreId, "nodes", oldId + ".json");
    const newPath = path.join(arbresPath, arbreId, "nodes", newId + ".json");

    if (!fs.existsSync(oldPath)) {
        throw new Error("Fichier introuvable");
    }

    fs.renameSync(oldPath, newPath);
});
ipcMain.handle("rename-node-index", (event, arbreId, oldId, newId) => {
    if (oldId=="root") return;
    const indexFile = path.join(arbresPath, arbreId, "index.json");

    if(!fs.existsSync(indexFile)){
        throw new Error("index.json introuvable");
    }

    const index = JSON.parse(fs.readFileSync(indexFile, "utf-8"));

    index.noeuds = index.noeuds.map(id =>
        id === oldId ? newId : id
    );
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
});
ipcMain.handle("load-index-arbre", (event, arbreId) => {
    try {
        const filePath = path.join(arbresPath, arbreId, "index.json");
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const raw = fs.readFileSync(filePath, "utf-8");
        if (!raw || raw.trim() === "") {
            return null;
        }
        return JSON.parse(raw);
    } catch (e) {
        console.error("Erreur lecture index arbre :", e);
        return null;
    }
});
ipcMain.handle("save-index-arbre", async (event,arbreId,index) => {
    const filePath =path.join(arbresPath, arbreId, "index.json");
    fs.writeFileSync(filePath, JSON.stringify(index, null, 2));
});
ipcMain.handle("delete-node", async (event, arbreId, nodeId) => {
    if (nodeId === "root") {
        throw new Error("Impossible de supprimer la racine");
    }
    const nodesDir = path.join(arbresPath, arbreId, "nodes");
    const indexPathArbre = path.join(arbresPath, arbreId, "index.json");
    // 🔹 charger index
    const index = JSON.parse(fs.readFileSync(indexPathArbre, "utf-8"));
    // 🔹 charger node à supprimer
    const nodePath = path.join(nodesDir, nodeId + ".json");

    if (!fs.existsSync(nodePath)) {
        throw new Error("Node introuvable");
    }
    const nodeToDelete = JSON.parse(fs.readFileSync(nodePath, "utf-8"));

    const children = nodeToDelete.suivant
        ? (Array.isArray(nodeToDelete.suivant)
            ? nodeToDelete.suivant
            : [nodeToDelete.suivant])
        : [];
    // 🔹 parcourir tous les nodes
    for (const id of index.noeuds) {
        if (id === nodeId) continue;
        const file = path.join(nodesDir, id + ".json");
        if (!fs.existsSync(file)) continue;
        const node = JSON.parse(fs.readFileSync(file, "utf-8"));
        if (!node.suivant) continue;

        let list = Array.isArray(node.suivant)
            ? node.suivant
            : [node.suivant];

        if (!list.includes(nodeId)) continue;
        // 🔥 supprimer nodeId
        list = list.filter(n => n !== nodeId);
        // 🔥 injecter enfants
        list = [...list, ...children];
        // 🔥 enlever doublons
        list = [...new Set(list)];
        // 🔥 remettre format
        if (list.length === 0) {
            node.suivant = null;
        } else if (list.length === 1) {
            node.suivant = list[0];
        } else {
            node.suivant = list;
        }
        fs.writeFileSync(file, JSON.stringify(node, null, 2));
    }
    // 🔹 supprimer fichier node
    fs.rmSync(nodePath, { force: true });
    // 🔹 update index
    index.noeuds = index.noeuds.filter(id => id !== nodeId);
    fs.writeFileSync(indexPathArbre, JSON.stringify(index, null, 2));
    return true;
});
ipcMain.handle("load-all-nodes", async (event, arbreId) => {
    const nodesDir = path.join(arbresPath, arbreId, "nodes");
    if (!fs.existsSync(nodesDir)) return [];
    const files = fs.readdirSync(nodesDir);
    const nodes = [];
    for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const filePath = path.join(nodesDir, file);
        try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const node = JSON.parse(raw);

            nodes.push({
                id: node.id,
                title: node.title
            });
        } catch (e) {
            console.error("Erreur lecture node:", filePath, e);
        }
    }
    console.log("ici main ===============");
    console.log("nodes",nodes);
    return nodes;
});
