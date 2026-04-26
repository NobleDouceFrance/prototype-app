const params = new URLSearchParams(window.location.search);
const arbreId = params.get("id");
let arbre=null;
let progress;

async function init(){
    // 1. charger progress
    progress = await window.electronAPI.loadProgress();
    // 2. charger index
    arbre = await window.electronAPI.loadIndexArbre(arbreId);

    if(!arbre){
        console.error("Arbre introuvable :", arbreId);
        return;
    }
    // 3. afficher infos arbre
    document.getElementById("titre").textContent = arbre.title;
    document.getElementById("description").textContent = arbre.description;
    // 4. construire arbre
    const niveaux = await construireArbre(arbre.root);
    console.log("1");
    afficherArbre(niveaux);
    // 5. progression
    console.log("2");
    const prog = await calculerProgression();

    let pourcent = 0;
    if(prog.total > 0){
        pourcent = Math.floor(prog.fait / prog.total * 100);
    }
    // 6. bouton continuer
    let last_node = null
    console.log(progress);
    if (progress) last_node=progress.arbres?.[arbreId]?.last_node;

    const btn = document.getElementById("commencer");
    console.log("ici");
    if(last_node && prog.fait==100){
        btn.textContent = "Terminé";
        btn.onclick = () => {
            window.location.href = `noeud.html?arbre=${arbreId}&node=${last_node}`;
        };
    }else if (last_node){
        console.log(btn.textContent);
        btn.textContent = "Continuer";
        btn.onclick = () => {
            window.location.href = `noeud.html?arbre=${arbreId}&node=${last_node}`;
        };
    }
    else {
        btn.onclick = () => {
            window.location.href = `noeud.html?arbre=${arbre.id}&node=${arbre.root}`;
        };
    }
    const btn_spr=document.getElementById("supprimer");
    btn_spr.onclick=()=>{
        const confirmDelete = confirm(`Supprimer "${arbre.title}" ?`);
        if(!confirmDelete) return;
        window.electronAPI.deleteArbre(arbreId);
        location.reload();
    }
    const duplicateBtn = document.getElementById("dupliquer");

    duplicateBtn.onclick = async (e) => {
        const confirmDelete = confirm(`Voulez-vous dupliquer cette arbre pour le modifié dans l'éditeur ?`);
        if(!confirmDelete) return;
        try{
            await window.electronAPI.duplicateArbre(arbre.id);
            location.reload();
        }catch(err){
            console.error(err);
            alert("Erreur duplication");
        }
    };
    console.log(prog);
    document.getElementById("progression").textContent =`${prog.fait}/${prog.total} (${pourcent}%)`;
}
init();
function getStatus(nodeId){
    const nodeProg = progress.arbres?.[arbreId]?.nodes?.[nodeId];
    if(!nodeProg) return "notVisited";
    if(nodeProg.validated===true) return "validated";
    return "visited";
}

async function construireArbre(rootId){
    const niveaux = [];
    const visited = new Set();
    let courant = [rootId];
    while(courant.length > 0){
        const prochain = [];
        const niveauNodes = [];
        for(const id of courant){
            if(visited.has(id)) continue;

            visited.add(id);
            const node = await window.electronAPI.loadNode(arbreId,id);
            niveauNodes.push({id,node});

            if(node.suivant){
                const enfants = Array.isArray(node.suivant)
                ? node.suivant
                : [node.suivant];
                enfants.forEach(e=>{
                    if(!visited.has(e)){
                        prochain.push(e);
                    }
                });
            }
        }
        if(niveauNodes.length>0){
            niveaux.push(niveauNodes);
        }
        courant = prochain;
    }
    return niveaux;
}
function afficherArbre(niveaux){
    const container = document.getElementById("arbreContainer");
    container.innerHTML = "";
    for (const niveau of niveaux){
        const div = document.createElement("div");
        div.className = "niveau";
        for (const {id, node} of niveau){

            const link = document.createElement("a");
            link.href = `noeud.html?arbre=${arbreId}&node=${id}`;
            link.textContent = node.title;

            const status = getStatus(id);
            link.className = status;

            const box = document.createElement("div");
            box.className = "node";

            box.appendChild(link);
            div.appendChild(box);
        }
        container.appendChild(div);
    }
}

async function calculerProgression(){
    let total = 0;
    let fait = 0;
    if(progress===null){
        console.log("folder non défini dans calculerProgression");
        return {fait,total};
    }
    const visited = new Set();
    const queue = ["root"];
    while(queue.length > 0){
        const id = queue.shift();

        if(visited.has(id)) continue;

        visited.add(id);
        const node = await window.electronAPI.loadNode(arbreId,id);

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
            const enfants = Array.isArray(node.suivant)? node.suivant: [node.suivant];
            enfants.forEach(e=>{
                if(!visited.has(e)){
                    queue.push(e);
                }
            });
        }
    }
    return {fait,total};
}