const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {

    saveProgress: (progress) => ipcRenderer.invoke("save-progress", progress),
    loadProgress: () => ipcRenderer.invoke("load-progress"),

    saveNode: (node, arbreId) =>ipcRenderer.invoke("save-node", node, arbreId),
    loadNode: (arbreId,nodeId) => ipcRenderer.invoke("load-node",arbreId,nodeId),

    saveIndex: (index) =>ipcRenderer.invoke("save-index", index),
    loadIndex:() => ipcRenderer.invoke("load-index"),
    
    openExternal: (url) => ipcRenderer.invoke("open-external", url),
    exportTest: (folder) => ipcRenderer.invoke("export-test", folder),
    exportZip: (folder) => ipcRenderer.invoke("export-zip", folder),

    createTree: (id, name) => ipcRenderer.invoke("create-tree", id, name),

    downloadAndInstall: (url, folder) => ipcRenderer.invoke("download-install", url, folder),

    deleteArbre: (id) => ipcRenderer.invoke("delete-arbre", id),

    duplicateArbre: (id) => ipcRenderer.invoke("duplicate-arbre", id),

    renameNodeFile:(arbreId,oldId,newId)=> ipcRenderer.invoke("rename-node-file",arbreId,oldId,newId),

    renameNodeIndex: (arbreId, oldId, newId) =>ipcRenderer.invoke("rename-node-index", arbreId, oldId, newId),

    loadIndexArbre:(arbreId)=>ipcRenderer.invoke("load-index-arbre",arbreId),
    saveIndexArbre:(arbreId,index)=>ipcRenderer.invoke("save-index-arbre",arbreId,index),
    deleteNode:(arbreId,nodeId)=>ipcRenderer.invoke("delete-node",arbreId,nodeId),

    loadAllNodes:(arbreId)=>ipcRenderer.invoke("load-all-nodes",arbreId),
});
contextBridge.exposeInMainWorld("testAPI", {
    ping: () => "pong"
});
