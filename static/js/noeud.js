const params = new URLSearchParams(window.location.search);
const arbreId = params.get("arbre");
const nodeId = params.get("node");

let arbreFolder = null;
let progress;
let arbreProgress;
let nodeProgress;
let preview= false;

async function init(){
    // 2. charger index
    let arbre = await window.electronAPI.loadIndexArbre(arbreId);
    const index = await window.electronAPI.loadIndex();
    if (index.creations.find(a => a.id === arbreId)){
        preview=true;
        }
    if (preview){
        retourEdition();
    } 
    // 1. charger progress
    progress = await window.electronAPI.loadProgress();
    if(!progress.arbres){
        progress.arbres = {};
    }
    // 3. construire progress
    arbreProgress = getArbreProgress(progress, arbreId);
    nodeProgress = getNodeProgress(arbreProgress, nodeId);
    // sécurité
    if(!nodeProgress.time_spent){
        nodeProgress.time_spent = 0;
    }
    nodeProgress.visited = true;
    nodeProgress.start_time = Date.now();
    arbreProgress.last_node = nodeId;

    arbreFolder = arbre.folder;
    // 4. charger node
    const node = await window.electronAPI.loadNode(arbreId,nodeId);

    window.currentNode = node;
    // 5. UI
    document.getElementById("titre").textContent = node.title;
    console.log("ici");
    const div = document.getElementById("footer");
    const link = document.createElement("a");
    link.href = `arbre.html?id=${arbreId}`;
    link.textContent = "Retour à l'arbre";
    div.appendChild(link);
    // score node
    calculerScoreNode(node);
    // score arbre
    const scoreArbre = await calculerProgression();
    document.getElementById("scoreArbre").textContent =`score de l'arbre : ${scoreArbre.fait} / ${scoreArbre.total}`;
    // overlay
    const overlay = document.getElementById("popupOverlay");
    overlay.addEventListener("click", (e)=>{
        if(e.target === overlay){
            overlay.classList.add("hidden");
        }
    });
    // blocs
    const container = document.getElementById("contenu");
    
    node.stack.forEach(blockId => {
        const block = node.blocks[blockId];
        afficherBloc(block, blockId, container);
    });
    // bouton suivant
    if(node.suivant == null){
        document.getElementById("suivant").textContent = "Terminer";
    }
    document.getElementById("suivant").onclick = async () => {
        const timeSpent = Math.floor(
            (Date.now() - nodeProgress.start_time) / 1000
        );
        nodeProgress.time_spent += timeSpent;

        if(nodeEstComplet(node)){
            nodeProgress.validated = true;
        }
        saveProgress(progress);
        gererSuivant(node);
    };
    saveProgress(progress);
}
init();
function saveProgress(progress){
    try{
        if (!preview){
            window.electronAPI.saveProgress(progress);
        }
    }catch(e){
        console.error("Erreur sauvegarde", e);
    }
}
function getArbreProgress(progress, arbreId){
    if(!progress.arbres){
        progress.arbres = {};
    }
    if(!progress.arbres[arbreId]){
        progress.arbres[arbreId] = {
            started: Date.now(),
            last_node: null,
            nodes: {}
        };
    }
    return progress.arbres[arbreId];
}
function getNodeProgress(arbreProgress, nodeId){
    if(!arbreProgress.nodes[nodeId]){
        arbreProgress.nodes[nodeId] = {
            visited: false,
            validated: false,
            blocks: {},   // ✅ essentiel
            time_spent: 0
        };
    }
    // 🔥 sécurité supplémentaire
    if(!arbreProgress.nodes[nodeId].blocks){
        arbreProgress.nodes[nodeId].blocks = {};
    }
    return arbreProgress.nodes[nodeId];
}
async function afficherBloc(block, blockId, container){
    if(block.type === "text"){
        const p = document.createElement("p");
        p.textContent = block.texte;
        p.innerHTML = block.texte;
        container.appendChild(p);
    }else if(block.type === "iframe"){
        const iframe = document.createElement("iframe");
        iframe.src = block.url;
        iframe.width = "100%";
        iframe.height = block.height || 400;
        container.appendChild(iframe);
    }else if(block.type === "qcm"){
        afficherQCM(block, blockId, container);
    }else if(block.type === "vof"){
        afficherQuestion(block, blockId, container);
    }else if (block.type==="q"){
        afficherQ(block,blockId,container);
    }
}
async function afficherQCM(block, blockId, container){
    const div = document.createElement("div");
    const q = document.createElement("p");
    q.textContent = block.question;

    div.appendChild(q);

    const saved = nodeProgress.blocks[blockId];

    block.answers.forEach(answer => {
        const btn = document.createElement("button");
        btn.textContent = answer.text;
        // restaurer couleur si réponse déjà donnée
        if(saved){
            if(answer.correct){
                btn.style.background = "green";
            }
            if(!answer.correct){
                btn.style.background = "red";
            }
            btn.disabled = true;
        }
        btn.onclick = () => {
            const isCorrect = answer.correct;
            if(isCorrect){
                btn.style.background = "green";
            } else {
                btn.style.background = "red";
            }

            nodeProgress.blocks[blockId] = {
                answered:true,
                correct:isCorrect
            };
            calculerScoreNode(window.currentNode);
            exp.style.display = "block";

            if(!progress.arbres[arbreId]){
                progress.arbres[arbreId] = { nodes: {} };
            }
            if(!progress.arbres[arbreId].nodes[nodeId]){
                progress.arbres[arbreId].nodes[nodeId] = {
                    blocks: {},
                    validated: false
                };
            }
            nodeProgress = progress.arbres[arbreId].nodes[nodeId];
            saveProgress(progress);
        };
        div.appendChild(btn);
    });
    const exp = document.createElement("p");
    exp.style.display = "none";
    exp.textContent = block.explication;
    if (progress.arbres?.[arbreId]?.nodes?.[nodeId].blocks?.[blockId]?.answered){
        exp.style.display = "block";
    }
    div.appendChild(exp);

    container.appendChild(div);
}
function afficherQuestion(block, blockId, container){
    const div = document.createElement("div");
    const q = document.createElement("p");
    q.textContent = block.question;

    div.appendChild(q);

    const btnV = document.createElement("button");
    const btnF = document.createElement("button");

    btnV.textContent = "Vrai";
    btnF.textContent = "Faux";

    const saved = nodeProgress.blocks[blockId];

    if(saved){
        if(saved.correct){
            btnV.style.background = "green";
            btnF.style.background = "red";
        } else {
            btnV.style.background = "red";
            btnF.style.background = "green";
        }
        btnV.disabled = true;
        btnF.disabled = true;
    }

    btnV.onclick = () => {
        const isCorrect = block.answers === true;

        if(isCorrect){
            btnV.style.background = "green";
            btnF.style.background = "red";
        } else {
            btnV.style.background = "red";
            btnF.style.background = "green";
        }
        nodeProgress.blocks[blockId] = {
            answered:true,
            correct:isCorrect
        };
        calculerScoreNode(window.currentNode);

        exp.style.display = "block";

        saveProgress(progress);
    };
    btnF.onclick = () => {
        const isCorrect = block.answers === false;
        if(isCorrect){
            btnF.style.background = "green";
            btnV.style.background = "red";
        } else {
            btnF.style.background = "red";
            btnV.style.background = "green";
        }
        nodeProgress.blocks[blockId] = {
            answered:true,
            correct:isCorrect
        };
        calculerScoreNode(window.currentNode);
        exp.style.display = "block";
        saveProgress(progress);
    };

    div.appendChild(btnV);
    div.appendChild(btnF);
    const exp = document.createElement("p");
    exp.style.display = "none";
    exp.textContent = block.explication;
    if (progress.arbres?.[arbreId]?.nodes?.[nodeId].blocks?.[blockId]?.answered){
        exp.style.display = "block";
    }
    div.appendChild(exp);

    container.appendChild(div);
}
function afficherQ(block,id,container){
    const div = document.createElement("div");
    const q = document.createElement("p");
    q.textContent = block.question;

    const reponse=document.createElement("input");
    const valider = document.createElement("button");
    valider.textContent="Valider";

    const saved = progress.arbres?.[arbreId]?.nodes?.[nodeId]?.blocks?.[id];
    if(saved){
        if(saved.correct){
            reponse.style.backgroundColor = "green";
            reponse.disabled = true;
            reponse.value=block.reponse;
        } 
    }
    valider.onclick =()=>{
        if (reponse.disabled){
            return;
        }
        const rep=reponse.value.trim();
        if (rep==block.reponse){
            reponse.style.backgroundColor="green";
            reponse.disabled=true;
            exp.style.display = "block";
        }else if (rep && rep!="" ){
            reponse.style.backgroundColor="red";
        }else {
            reponse.style.backgroundColor="grey";
        }
        // 🔒 INIT STRUCTURE (copié de ton QCM)
        if(!progress.arbres[arbreId]){
            progress.arbres[arbreId] = { nodes: {} };
        }
        if(!progress.arbres[arbreId].nodes[nodeId]){
            progress.arbres[arbreId].nodes[nodeId] = {
                blocks: {},
                validated: false
            };
        }
        // 🔒 pointer vers nodeProgress
        const nodeProg = progress.arbres[arbreId].nodes[nodeId];
        // ✅ SAUVEGARDE
        nodeProg.blocks[id] = {
            answered: true,
            correct: rep==block.reponse,
            value: rep // important pour restaurer
        };
        calculerScoreNode(window.currentNode);
        saveProgress(progress);
    }
    div.appendChild(q);
    div.appendChild(reponse);
    div.appendChild(valider);

    const exp = document.createElement("p");
    exp.style.display = "none";
    exp.textContent = block.explication;
    if (progress.arbres?.[arbreId]?.nodes?.[nodeId].blocks?.[id]?.answered){
        exp.style.display = "block";
    }
    div.appendChild(exp);

    container.appendChild(div);
}

async function findNextUnvalidated(){
    console.log("find next");
    const visited = new Set();
    const queue = ["root"];

    while(queue.length > 0){
        const id = queue.shift();

        if(visited.has(id)) continue;

        visited.add(id);

        const node = await window.electronAPI.loadNode(arbreId,id);
        const nodeProg =progress.arbres?.[arbreId]?.nodes?.[id];

        if(!nodeProg || !nodeProg.validated){
            return id;
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
    return null;
}
async function choisirSuivant(liste){
    console.log("liste",liste);
    document.getElementById("popupOverlay").classList.remove("hidden");
    const choixDiv = document.getElementById("popupChoices");
    choixDiv.innerHTML = "";

    const nodes = await Promise.all(liste.map(id => window.electronAPI.loadNode(arbreId, id)));

    nodes.forEach((node, i) => {
        const id = liste[i];
        const btn = document.createElement("button");
        btn.textContent = node.title;

        btn.onclick = () => {
            window.location.href = `noeud.html?arbre=${arbreId}&node=${id}`;
        };

        choixDiv.appendChild(btn);
    });
}
async function gererSuivant(node){
    if(!node){
        console.error("node non défini");
        return;
    }
    const suivant = node.suivant;
    if(suivant == null){
        const next = await findNextUnvalidated();
        console.log(next);
        if(next === nodeId){
            alert("Terminez cette page !");
            return;
        }
        if(next){
            window.location.href = `noeud.html?arbre=${arbreId}&node=${next}`;
        } else {
            alert("Félicitations !");
            window.location.href = `arbre.html?id=${arbreId}`;
        }
        return;
    }
    if(typeof suivant === "string"){
        window.location.href = `noeud.html?arbre=${arbreId}&node=${suivant}`;
        return;
    }
    if(Array.isArray(suivant)){
        if(suivant.length === 1){
            window.location.href = `noeud.html?arbre=${arbreId}&node=${suivant[0]}`;
        } else {
            choisirSuivant(suivant);
        }
    }
}
document.getElementById("popupOverlay").addEventListener("click", (e)=>{
    if(e.target.id === "popupOverlay"){
        document.getElementById("popupOverlay").classList.add("hidden");
    }
});
function nodeEstValide(nodeProgress){
    for(const blockId in nodeProgress.blocks){
        const block = nodeProgress.blocks[blockId];

        if(block.answered !== true){
            return false;
        }
    }
    return true;
}
function nodeEstComplet(node){
    for(const blockId of node.stack){
        const block = node.blocks[blockId];

        if(block.type === "qcm" || block.type === "vof"){
            const b = nodeProgress.blocks[blockId];

            if(!b || !b.answered){
                return false;
            }
        }
    }
    return true;
}
function calculerScoreNode(node){
    let total = 0;
    let correct = 0;
    node.stack.forEach(blockId => {
        const block = node.blocks[blockId];
        // seulement les blocs interactifs
        if(block.type === "qcm" || block.type === "vof"){
            total++;
            const blockProg = nodeProgress.blocks?.[blockId];
            if(blockProg && blockProg.answered){
                correct++;
            }
        }
    });
    document.getElementById("scoreNode").textContent =`score du noeud : ${correct} / ${total}`;
    return;
}
async function calculerProgression(){
    if(!arbreId){
        console.error("folder non défini dans calculerProgression");
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
function retourEdition(){
    const btn=document.createElement("button");
    btn.textContent="Mode éditeur";
    btn.onclick = () => {
        window.location.href ="editeur_noeud.html?arbre="+arbreId+"&node="+nodeId;
    };
    document.getElementById("retour-edition").appendChild(btn);
}
