// On attend que le DOM soit prêt
document.addEventListener("DOMContentLoaded", () => {
    loadTrees();
});
let progress;
async function loadTrees() {
    try {
        progress = await window.electronAPI.loadProgress();
        // Fetch du fichier index.json
        const data = await window.electronAPI.loadIndex();
        const treeList = document.getElementById("treeList");
        // On parcourt la liste des arbres
        for (const arbre of data.arbres) {
            const card = document.createElement("div");
            card.classList.add("tree-card");

            let prog = await calculerProgression(arbre.folder,arbre.id);
            let pourcent = 0;

            if(prog.total > 0){
                pourcent = Math.floor(prog.fait / prog.total * 100);
            }
            const titre = document.createElement("h3");
            titre.textContent = arbre.title;

            const id = document.createElement("p");
            id.textContent = "ID : " + arbre.id;

            const progression = document.createElement("p");
            progression.textContent = "% : " + pourcent;

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "🗑️ Supprimer";

            deleteBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const confirmDelete = confirm(`Supprimer "${arbre.title}" ?`);
                if(!confirmDelete) return;

                try{
                    await window.electronAPI.deleteArbre(arbre.id);
                    location.reload();
                }catch(e){
                    console.error(e);
                    alert("Erreur suppression");
                }
            };
            card.appendChild(deleteBtn);
            card.appendChild(titre);
            card.appendChild(id);
            card.appendChild(progression);

            card.addEventListener("click", function(e) {
                if(e.defaultPrevented) return;
                window.location.href = "arbre.html?id=" + arbre.id;
            });
            treeList.appendChild(card);
        }
    } catch (error) {
        console.error("Erreur chargement des arbres :", error);
    }
}
async function calculerProgression(folder,arbreId){
    if(!folder || progress===null){
        console.log("folder non défini dans calculerProgression");
        return {fait:0,total:0};
    }
    const visited = new Set();
    const queue = ["root"];
    let total = 0;
    let fait = 0;

    while(queue.length > 0){
        const id = queue.shift();
        if(visited.has(id)) continue;

        visited.add(id);
        const node = await window.electronAPI.loadNode(folder,id);
        if(!node){
            console.error("Node introuvable :", id);
            continue;
        }
        total++;
        const nodeProg = progress.arbres?.[arbreId]?.nodes?.[id];

        if(nodeProg && nodeProg.validated === true){
            fait++;
        }

        if(node.suivant){
            const enfants = Array.isArray(node.suivant)
                ? node.suivant
                : [node.suivant];
            enfants.forEach(e=>{
                if(!visited.has(e)){
                    queue.push(e);
                }
            });
        }
    }
    return {fait,total};
}
