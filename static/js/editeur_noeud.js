const params = new URLSearchParams(window.location.search);
const arbreId = params.get("arbre");
const nodeId = params.get("node") || "root";
window.currentNode = {id: nodeId,title: "",stack: [],blocks: {}};
document.title = currentNode.title || currentNode.id;
const DEBUG = true;
let dragged = null;
let saveTimeout = null;

function triggerAutoSave(){
    clearTimeout(saveTimeout);

    saveTimeout = setTimeout( async() => {
        await sauvegarderNoeud(currentNode);
        console.log("Auto-save ✔");
    }, 800);
}
chargerNode();
async function chargerNode(){
    console.log("charger node");
    try{
        console.log("3");
        const data = await window.electronAPI.loadNode(arbreId,nodeId);
        if(data){
            window.currentNode = data;
        }
    }catch(e){
        console.log("Node nouveau");
    }
    afficherEditeur();
}
async function afficherEditeur(){
    console.log("1");
    const score =calculerScoreNode();
    document.getElementById("scoreNode").textContent ="Score : "+score;
    console.log("2");
    const node_title=document.getElementById("nodeTitle");
    node_title.value =currentNode.title || "";
    const btn_node_title=document.getElementById("btnChangementTitre");
    console.log("3");
    btn_node_title.onclick=async () =>{
        await renameNode(node_title.value);
    }
    const container = document.getElementById("blocsContainer");
    container.innerHTML = "";

    currentNode.stack.forEach(blockId => {
        const block = currentNode.blocks[blockId];
        afficherBloc(block, blockId, container);
    });
    const btn_suppr_noeud = document.getElementById("btnSupprimerNoeud");
    btn_suppr_noeud.onclick=async()=>{
        if (nodeId=="root") {
            alert("impossible de supprimr la racine.");
            return;
        }
        const confirmDelete = confirm(`Voulez-vous vraiment supprimer ce noeud ? \nTous les éléments ajouter : image, pdf, etc. sertont conservés.\n L'arbre sera reconnecter.`);
        if(!confirmDelete) return;
        await supprimerNoeud();
    }
    afficherSuivants();
}
function afficherBloc(block, id, container){
    const div = document.createElement("div");
    div.className = "bloc";
    
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "X";

    deleteBtn.onclick = () => {
        const confirmDelete = confirm(`Supprimer "${id}" ?`);
        if(!confirmDelete) return;
        supprimerBloc(id);
        console.log(currentNode.stack);
    };

    div.appendChild(deleteBtn);

    const idInput = document.createElement("input");
    idInput.value = id;
    idInput.className = "block-id";
    idInput.onchange = () => {
        const newId = idInput.value.trim();
        console.log(newId);

        if(!newId){
            alert("ID invalide");
            idInput.value = id;
            return;
        }
        renameBlock(id, newId);
    };
    div.appendChild(idInput);

    if(block.type === "qcm"){
        afficherBlocQCM(block, id, div);
    }else if(block.type === "text"){
        // ATTENTION : inject du html, donc attention si <script> ! 
        const textarea = document.createElement("textarea");
        textarea.value = block.texte || "";
        textarea.oninput = () => {
            block.texte = textarea.value;
            autoResizeTextarea(textarea);
            triggerAutoSave();
        };
        setTimeout(() => {
            autoResizeTextarea(textarea);
        }, 0);
        textarea.addEventListener("keydown", (e) => {
            if(e.key === "Tab"){
                e.preventDefault();

                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                // insérer une tabulation (ou espaces)
                const tab = "\t"; // ou "\t" si tu préfères

                textarea.value =
                    textarea.value.substring(0, start) +
                    tab +
                    textarea.value.substring(end);
                // replacer le curseur
                textarea.selectionStart = textarea.selectionEnd = start + tab.length;
                // mettre à jour ton block
                block.texte = textarea.value;

                triggerAutoSave();
            }
        });


        div.appendChild(textarea);
        
        // bouton ajouter lien
        const btnLink = document.createElement("button");
        btnLink.textContent = "AJouter un effet";

        btnLink.onclick = () => {
            //const url = prompt("URL ?");
            //const texte = prompt("Texte ?");
            //if(!url || !texte){
              //  alert("Au moins un élément est non spécifié");
                //return;
            //}
            //const lien = `<a href="${url}" target="_blank">${texte}</a>`;
            //textarea.value += lien;
            //block.texte = textarea.value;
            alert("Arrive bientôt ! (avec mettre en gras, souligné, changé la couleur, etc.)");
        };
        div.appendChild(btnLink);
    }else if (block.type==="vof"){
        afficherBlocVoF(block, id, div);
    }else if (block.type==="iframe"){
        afficherBlocIframe(block,id,div);
    }else if (block.type==="q"){
        afficherBlocQ(block,id,div);
    }
    container.appendChild(div);
}
function afficherBlocQCM(block, id, container){
    // question
    const inputQ = document.createElement("input");
    inputQ.placeholder = "Question";
    inputQ.value = block.question;

    inputQ.oninput = () => {
        block.question = inputQ.value;
        autoResizeInput(inputQ);
        triggerAutoSave();
    };
    setTimeout(() => {
        autoResizeInput(inputQ);
    }, 0);
    container.appendChild(inputQ);
    // réponses
    const answersDiv = document.createElement("div");

    block.answers.forEach((ans, index) => {
        const line = document.createElement("div");
        // texte réponse
        const input = document.createElement("input");
        input.value = ans.text;
        input.placeholder = "Réponse";

        input.oninput = () => {
            ans.text = input.value;
            autoResizeInput(input);
            triggerAutoSave();
        };
        setTimeout(() => {
            autoResizeInput(input);
        }, 0);
        // checkbox correct
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = ans.correct;

        checkbox.onclick = () => {
            ans.correct = checkbox.checked;
        };
        // supprimer réponse
        const del = document.createElement("button");
        del.textContent = "❌";

        del.onclick = () => {
            block.answers.splice(index,1);
            afficherEditeur();
        };
        line.appendChild(checkbox);
        line.appendChild(input);
        line.appendChild(del);

        answersDiv.appendChild(line);
    });
    container.appendChild(answersDiv);
    // ajouter réponse
    const addAnswer = document.createElement("button");
    addAnswer.textContent = "➕ Ajouter réponse";

    addAnswer.onclick = () => {
        block.answers.push({text:"", correct:false});
        afficherEditeur();
    };
    container.appendChild(addAnswer);
    // explication
    const exp = document.createElement("textarea");
    exp.placeholder = "Explication";
    exp.value = block.explication;

    exp.oninput = () => {
        block.explication = exp.value;
        autoResizeTextarea(exp);
        triggerAutoSave();
    };
    setTimeout(() => {
        autoResizeTextarea(exp);
    }, 0);
    container.appendChild(exp);
}
function afficherBlocVoF(block, id, container){
    // question
    const inputQ = document.createElement("input");
    inputQ.placeholder = "Question";
    inputQ.value = block.question;

    inputQ.oninput = () => {
        block.question = inputQ.value;
        autoResizeInput(inputQ);
        triggerAutoSave();
    };
    setTimeout(() => {
        autoResizeInput(inputQ);
    }, 0);
    container.appendChild(inputQ);
    // réponses
    const answersDiv = document.createElement("button");
    answersDiv.textContent="Vrai";
    block.answers=true;
    answersDiv.onclick=()=>{
        if (answersDiv.textContent==="Vrai"){
            answersDiv.textContent="Faux";
            block.answers=false;
        }else{
            answersDiv.textContent="Vrai";
            block.answers=true;

        }
    }
    container.appendChild(answersDiv);
    // explication
    const exp = document.createElement("textarea");
    exp.placeholder = "Explication";
    exp.value = block.explication;

    exp.oninput = () => {
        block.explication = exp.value;
        autoResizeTextarea(exp);
        triggerAutoSave();
    };
    setTimeout(() => {
        autoResizeTextarea(exp);
    }, 0);
    container.appendChild(exp);
}

function afficherBlocIframe(block,id,container){
    console.log("affiche iframe");
    const inputURL = document.createElement("input");
    inputURL.placeholder = "URL";
    inputURL.value = block.url;
    inputURL.style.width="60%";

    inputURL.oninput = () => {
        block.url = inputURL.value;
        autoResizeInput(inputURL);
        triggerAutoSave();
    };
    container.appendChild(inputURL);
}
function afficherBlocQ(block,id,container){
    const inputQ = document.createElement("input");
    inputQ.placeholder = "Question";
    inputQ.value = block.question;

    inputQ.oninput = () => {
        block.question = inputQ.value;
        autoResizeInput(inputQ);
        triggerAutoSave();
    };
    setTimeout(() => {
        autoResizeInput(inputQ);
    }, 0);
    const reponse=document.createElement("input");
    reponse.placeholder = "Réponse";
    reponse.value = block.reponse;

    reponse.oninput = () => {
        block.reponse = reponse.value;
        autoResizeInput(reponse);
        triggerAutoSave();
    };
    setTimeout(() => {
        autoResizeInput(reponse);
    }, 0);
    container.appendChild(inputQ);
    container.appendChild(reponse);

    const exp = document.createElement("textarea");
    exp.placeholder = "Explication";
    exp.value = block.explication;

    exp.oninput = () => {
        block.explication = exp.value;
        autoResizeTextarea(exp);
        triggerAutoSave();
    };
    setTimeout(() => {
        autoResizeTextarea(exp);
    }, 0);
    container.appendChild(exp);
}
document.getElementById("addBlock").onclick = () => {
    if (document.getElementById("popupType").style.display=="block"){
        document.getElementById("popupType").style.display = "none";
    }else {
        document.getElementById("popupType").style.display = "block";
    }
};
function ajouterBloc(type){
    let id = "b" + Date.now();
    if(currentNode.blocks[id]){
        id = "c" + Date.now();
    }
    if(type === "text"){
        currentNode.blocks[id] = {type:"text"};
    }else if(type === "qcm"){
        currentNode.blocks[id] = {type:"qcm",question:"",answers:[{text:"", correct:true},{text:"", correct:false}],explication:""};
    }else if(type==="vof"){
        currentNode.blocks[id] = {type:"vof",question:"",answers:true,explication:""};
    }else if(type==="iframe"){
        currentNode.blocks[id] = {type:"iframe",url:""};
    }else if (type==="q"){
        currentNode.blocks[id]={type:"q",question:"",reponse:""};
    }
    else{
        console.error("type indéfini :",type);
    }
    // 🔒 ajouter à la stack
    currentNode.stack.push(id);
    fermerPopup();
    afficherEditeur();
}
function fermerPopup(){
    document.getElementById("popupType").style.display = "none";
}
document.getElementById("saveNode").onclick =async () =>  {
    currentNode.title = document.getElementById("nodeTitle").value;
    console.log("titre",currentNode.title);
    showSaveFeedback("sauvegardé","green");
    await sauvegarderNoeud(currentNode);
};
async function afficherSuivants() {
    const container = document.getElementById("suivantsContainer");
    container.innerHTML = "";

    if (!currentNode.suivant) return;

    const list = Array.isArray(currentNode.suivant)? currentNode.suivant: [currentNode.suivant];

    console.log(list);

    for (let index = 0; index < list.length; index++) {
        const id = list[index];

        const div = document.createElement("div");
        const span = document.createElement("span");

        console.log(id, index);

        let data = await window.electronAPI.loadNode(arbreId, id)
        console.log(data);
        try {
            data = await window.electronAPI.loadNode(arbreId, id);
        } catch (e) {
            console.error("Node introuvable :", id);
        }
        
        if (data) {
            span.textContent = data.title + " (" + id + ")";
        } else {
            span.textContent = "⚠️ " + id + " (non créé)";
        }

        // 🔴 supprimer lien
        const del = document.createElement("button");
        del.textContent = "❌";

        del.onclick = async () => {
            const confirmDelete = confirm(`Supprimer "${id}"de la suite ? (noeud conservé)`);
            if (!confirmDelete) return;

            list.splice(index, 1);

            if (list.length === 0) {
                currentNode.suivant = null;
            } else if (list.length === 1) {
                currentNode.suivant = list[0];
            } else {
                currentNode.suivant = list;
            }

            afficherEditeur();
            await sauvegarderNoeud(currentNode);
        };

        // ✏️ edit
        const editBtn = document.createElement("button");
        editBtn.textContent = "✏️";

        editBtn.onclick = () => {
            window.location.href = `editeur_noeud.html?arbre=${arbreId}&node=${id}`;
        };

        div.appendChild(span);
        div.appendChild(editBtn);
        div.appendChild(del);

        container.appendChild(div);
    }
}

document.getElementById("addNext").onclick = () => {
    document.getElementById("popupOverlay").classList.remove("hidden");
    document.getElementById("popupZone").innerHTML = "";
};
async function getAllNodes(){
    console.log("getallnodes");
    const res = await window.electronAPI.loadAllNodes(arbreId);
    console.log("res",res);
    return res;
}
async function ajouterSuivant(id){
    const normalized_id=normalizeId(id);
    if(currentNode.suivant &&(currentNode.suivant === normalized_id ||(Array.isArray(currentNode.suivant) && currentNode.suivant.includes(normalized_id)))){
        alert("Déjà ajouté");
        return;
    }
    if(normalized_id === currentNode.id){
        alert("Impossible de se référencer soi-même");
        return;
    }
    // vérifier si fichier existe
    let exists = true;
    try{
        const r = await window.electronAPI.loadNode(arbreId,normalized_id);
    }catch{
        exists = false;
    }
    // si n'existe pas → créer
    if(!exists){
        const newNode = {
            id:normalized_id,
            title:id,
            stack:[],
            blocks:{},
            validite:false
        };
        await sauvegarderNoeud(newNode,true);
        const index=await window.electronAPI.loadIndexArbre(arbreId);
        if (!index.noeuds.includes(normalized_id)) {
            index.noeuds.push(normalized_id);
            console.log("maj index",index);
            await window.electronAPI.saveIndexArbre(arbreId,index);
        }      
    }
    // ajouter au suivant
    if(!currentNode.suivant){
        currentNode.suivant = normalized_id;
    }
    else if(typeof currentNode.suivant === "string"){
        currentNode.suivant = [currentNode.suivant, normalized_id];
    }
    else{
        currentNode.suivant.push(normalized_id);
    }
    await sauvegarderNoeud(currentNode);
    afficherEditeur();
}
async function addNodeToIndex(id){
    const normalized_id=normalizeId(id);
    if(!window.electronAPI) return;

    const data = await window.electronAPI.loadIndexArbre(arbreId);
    console.log(data.noeuds);
    if(!data.noeuds){
        data.noeuds = [];
    }
    if(!data.noeuds.includes(normalized_id)){
        data.noeuds.push(normalized_id);
        data.node_count = data.noeuds.length;
    }
    await sauvegarderNoeud(currentNode);
}
document.getElementById("closePopup").onclick = () => {
    document.getElementById("popupOverlay").classList.add("hidden");
};

document.getElementById("popupOverlay").addEventListener("click", (e)=>{
    if(e.target.id === "popupOverlay"){
        e.currentTarget.classList.add("hidden");
    }
});
document.getElementById("btnChoisirExistant").onclick = async () => {
    const list = await getAllNodes();
    const zone = document.getElementById("popupZone");
    zone.innerHTML = "";
    const select = document.createElement("select");
    console.log("liste entière : ",list);
    for (const node of list) {
        const opt = document.createElement("option");
        opt.value = node.id;
        opt.textContent = node.title + " (" + node.id + ")";
        select.appendChild(opt);
    }
    const btn = document.createElement("button");
    btn.textContent = "Ajouter";
    btn.onclick = () => {
        const id = select.value;
        ajouterSuivant(id);
        document.getElementById("popupOverlay").classList.add("hidden");
    };
    zone.appendChild(select);
    zone.appendChild(btn);
};
document.getElementById("btnCreerNode").onclick = () => {
    const zone = document.getElementById("popupZone");
    zone.innerHTML = "";

    const input = document.createElement("input");
    input.placeholder = "ID du node";

    const btn = document.createElement("button");
    btn.textContent = "Créer";

    btn.onclick =async () => {
        const id = input.value.trim();

        if(!id){
            return;
        }
        ajouterSuivant(id);
        const newNode = {id:normalizeId(id),title:id,stack:[],blocks:{},validite:false};
        await sauvegarderNoeud(newNode,true);
        await sauvegarderNoeud(currentNode);

        addNodeToIndex(id);
    };
    zone.appendChild(input);
    zone.appendChild(btn);
};

async function sauvegarderNoeud(node, skipValidation = false){
    if(!skipValidation){
        node.validite = validerNode(node) && validerSuivants(node);
        if(!validerNode(node)){
            console.error("Node invalide → sauvegarde annulée");
            return;
        }
        if(!validerSuivants(node)){
            console.error("suivant(s) invalide(s)");
            return;
        }
    }

    await window.electronAPI.saveNode(node, arbreId);
}

function calculerScoreNode(){
    let total = 0;
    for(const blockId in window.currentNode.blocks){
        const block = window.currentNode.blocks[blockId];
        if(block.type === "qcm" || block.type === "vraioufaux"){
            total++;
        }
    }
    return total;
}
async function renameNode(newTitle) {
    if (nodeId === "root") return;
    const newId = normalizeId(newTitle);
    if (nodeId === newId) return;
    const nodes = await getAllNodes();
    if (nodes.includes(newId)) {
        alert("ID déjà existant");
        return;
    }
    // 🔹 1. modifier currentNode AVANT tout
    currentNode.id = newId;
    currentNode.title = newTitle;
    // 🔹 3. rename fichier
    await window.electronAPI.renameNodeFile(arbreId, nodeId, newId);
    // 🔹 2. sauvegarder TEMPORAIREMENT sous ancien nom
    await sauvegarderNoeud(currentNode);
    // 🔹 4. update tous les nodes
    for (const id of nodes) {
        if (id === nodeId) continue;

        const node = await window.electronAPI.loadNode(arbreId, id);
        let modified = false;

        if (node.suivant) {
            if (typeof node.suivant === "string") {
                if (node.suivant === nodeId) {
                    node.suivant = newId;
                    modified = true;
                }
            }

            if (Array.isArray(node.suivant)) {
                const updated = node.suivant.map(n =>n === nodeId ? newId : n);
                if (JSON.stringify(updated) !== JSON.stringify(node.suivant)) {
                    node.suivant = updated;
                    modified = true;
                }
            }
        }
        if (modified) {
            await sauvegarderNoeud(node, true);
        }
    }
    // 🔹 5. update index
    await window.electronAPI.renameNodeIndex(arbreId, nodeId, newId);
    // 🔹 6. navigation
    window.location.href = `editeur_noeud.html?arbre=${arbreId}&node=${newId}`;
}
async function detectCycle(startId){
    const visited = new Set();
    const stack = new Set();

    async function dfs(id){
        if(stack.has(id)) return true;
        if(visited.has(id)) return false;

        visited.add(id);
        stack.add(id);
        console.log("1");
        const node = await window.electronAPI.loadNode(arbreId,id);

        if(node.suivant){
            const list = Array.isArray(node.suivant)
                ? node.suivant
                : [node.suivant];
            for(const n of list){
                if(await dfs(n)) return true;
            }
        }
        stack.delete(id);
        return false;
    }
    return await dfs(startId);
}
async function supprimerBloc(blockId){
    currentNode.stack =currentNode.stack.filter(id => id !== blockId);

    delete currentNode.blocks[blockId];
    currentNode.stack = currentNode.stack.filter(id => id !== blockId);

    await sauvegarderNoeud(currentNode);
    location.reload();
}
async function renameBlock(oldId, newId){
    // ❌ même id
    if(oldId === newId) return;
    // ❌ déjà utilisé
    if(currentNode.blocks[newId]){
        alert("ID déjà utilisé");
        return;
    }
    // 1. copier bloc
    currentNode.blocks[newId] =currentNode.blocks[oldId];
    // 2. supprimer ancien
    delete currentNode.blocks[oldId];
    // 3. mettre à jour stack
    currentNode.stack =
        currentNode.stack.map(id =>
            id === oldId ? newId : id
        );
    await sauvegarderNoeud(currentNode);
    // 🔥 recharger affichage
    location.reload();
}
document.getElementById("reorderBlocks").onclick = () => {
    console.log("STACK :", currentNode.stack);
    ouvrirPopupStack();
};
function ouvrirPopupStack(){
    const popup = document.getElementById("popupStack");
    const container = document.getElementById("stackContainer");

    if(!currentNode){
        console.error("currentNode non défini");
        return;
    }
    if(!currentNode.stack){
        currentNode.stack = [];
    }
    container.innerHTML = "";
    if(currentNode.stack.length === 0){
        container.textContent = "Aucun bloc à réorganiser";
    }
    currentNode.stack.forEach(id => {
        const div = document.createElement("div");

        div.className = "stack-item";
        div.draggable = true;
        div.dataset.id = id;

        const block = currentNode.blocks[id];

        if(block){
            div.textContent = id + " (" + block.type + ")";
        }else{
            div.textContent = "⚠️ " + id;
        }
        ajouterDragEvents(div);
        container.appendChild(div);
    });
    popup.classList.remove("hidden");
}
function ajouterDragEvents(el){
    el.addEventListener("dragstart", () => {
        dragged = el;
    });
    el.addEventListener("dragover", (e) => {
        e.preventDefault();
    });
    el.addEventListener("drop", (e) => {
        e.preventDefault();

        if(dragged === el) return;

        const parent = el.parentNode;
        parent.insertBefore(dragged, el);
    });
}
document.getElementById("saveOrder").onclick = async () => {
    const items = document.querySelectorAll(".stack-item");
    let newStack = Array.from(items).map(el => el.dataset.id);
    // 🔒 1. supprimer doublons
    newStack = [...new Set(newStack)];
    // 🔒 2. garder uniquement blocs existants
    newStack = newStack.filter(id => currentNode.blocks[id]);
    // 🔒 3. empêcher stack vide
    if(newStack.length === 0){
        alert("Impossible : aucun bloc valide");
        return;
    }
    // 🔒 4. vérifier cohérence
    const invalid = newStack.filter(id => !currentNode.blocks[id]);
    if(invalid.length > 0){
        alert("Blocs invalides détectés : " + invalid.join(", "));
        return;
    }
    // ✅ appliquer
    currentNode.stack = newStack;
    await sauvegarderNoeud(currentNode);
    showSaveFeedback("✔ Sauvegardé",'green');
    document.getElementById("popupStack").classList.add("hidden");

    afficherEditeur();
};
document.getElementById("closeStack").onclick = () => {
    document.getElementById("popupStack").classList.add("hidden");
};
document.getElementById("popupStack").addEventListener("click", (e)=>{
    if(e.target.id === "popupStack"){
        e.currentTarget.classList.add("hidden");
    }
});

function showSaveFeedback(texte,couleur){
    const msg = document.createElement("div");
    msg.textContent = texte;
    msg.style.position = "fixed";
    msg.style.bottom = "20px";
    msg.style.right = "20px";
    msg.style.background = couleur;
    msg.style.color = "white";
    msg.style.padding = "10px";

    document.body.appendChild(msg);

    setTimeout(()=> msg.remove(), 2000);
}
function validerNode(node){
    if(!node.blocks){
        console.error("Pas de blocks");
        return false;
    }
    if(!node.stack){
        console.error("Pas de stack");
        return false;
    }
    // 🔒 stack non vide
    if(node.stack.length === 0){
        alert("Stack vide");
        return false;
    }
    // 🔒 chaque id de stack existe
    for(const id of node.stack){
        if(!node.blocks[id]){
            alert("Bloc manquant : " + id);
            return false;
        }
        if(!node.blocks[id].type){
        alert("Bloc sans type : " + id);
        return false;
    }
    }
    // 🔒 aucun bloc orphelin
    for(const id in node.blocks){
        if(!node.stack.includes(id)){
            console.warn("Bloc non utilisé :", id);
        }
    }
    return true;
}
function validerSuivants(node){
    if(!node.suivant) return true;

    const list = Array.isArray(node.suivant)? node.suivant: [node.suivant];
    const unique = new Set();

    for(const id of list){
        if(id === node.id){
            alert("Un node ne peut pas pointer vers lui-même");
            return false;
        }
        if(unique.has(id)){
            alert("Doublon dans suivants : " + id);
            return false;
        }
        unique.add(id);
    }
    return true;
}
async function validerArbre(folder){
    const visited = new Set();
    const stack = new Set(); // pour détecter cycles
    let erreurs = [];

    async function dfs(nodeId){
        // 🔒 node déjà exploré
        if(visited.has(nodeId)) return;

        // 🔴 cycle détecté
        if(stack.has(nodeId)){
            console.warn("Cycle autorisé :", nodeId);
            return;
        }
        stack.add(nodeId);
        let node
        try{
            console.log("2");
            node = await window.electronAPI.loadNode(folder,nodeId);
            console.log(node);
            if(!node){
                erreurs.push("Node introuvable : " + nodeId);
                return;
            }
        }catch(e){
            erreurs.push("Erreur chargement : " + nodeId);
            return;
        }
        visited.add(nodeId);
        // 🔒 vérifier suivant
        if(node.suivant){
            const list = Array.isArray(node.suivant)? node.suivant: [node.suivant];

            for(const next of list){
                if(!next){
                    erreurs.push("Suivant vide dans " + nodeId);
                    continue;
                }
                await dfs(next);
            }
        }
        stack.delete(nodeId);
    }
    // 🔥 démarrage depuis root
    await dfs("root");
    // 🔒 résultat
    if(erreurs.length > 0){
        console.error("Erreurs arbre :", erreurs);
        alert("Erreurs détectées :\n" + erreurs.join("\n"));
        return false;
    }
    console.log("Arbre valide ✔");
    return true;
}
document.getElementById("validateTree").onclick = async () => {
    const ok = await validerArbre(arbreId);
    if(ok){
        console.log("Arbre OK");
        currentNode.validite=true;
        await sauvegarderNoeud(currentNode);
    }
};
function afficherPreview(node){
    const container = document.getElementById("previewContainer");

    if(!container){
        console.error("previewContainer introuvable");
        return;
    }
    container.innerHTML = "";
    if(!node || !node.stack){
        container.textContent = "Aucun contenu à afficher";
        return;
    }
    node.stack.forEach(blockId => {
        const block = node.blocks[blockId];
        if(!block){
            console.warn("Bloc manquant :", blockId);
            return;
        }
        afficherBlocPreview(block, blockId, container);
    });
}
function afficherBlocPreview(block, blockId, container){
    const div = document.createElement("div");
    div.className = "preview-block";

    if(block.type === "text"){
        const p = document.createElement("p");
        p.textContent = block.texte;

        div.appendChild(p);
    }
    if(block.type === "qcm"){

        const q = document.createElement("p");
        q.textContent = block.question;
        div.appendChild(q);

        block.answers.forEach(ans => {
            const btn = document.createElement("button");
            btn.textContent = ans.text;
            // couleur indicative
            if(ans.correct){
                btn.style.border = "2px solid green";
            }
            btn.disabled = true;
            div.appendChild(btn);
        });
        if(block.explication){
            const exp = document.createElement("p");
            exp.textContent = block.explication;
            exp.style.fontStyle = "italic";
            div.appendChild(exp);
        }
    }
    container.appendChild(div);
}
function log(...args){
    if(DEBUG) console.log(...args);
}
function warn(...args){
    if(DEBUG) console.warn(...args);
}
function error(...args){
    console.error(...args); // toujours affiché
}
document.getElementById("previewMode").onclick = () => {
    window.location.href =`noeud.html?arbre=${arbreId}&node=${currentNode.id}`;
};
function autoResizeTextarea(el){
    el.style.height = "auto";              // reset
    el.style.height = el.scrollHeight + "px"; // ajuste
}
function autoResizeInput(el){
    el.style.width = "auto";
    el.style.width = (el.scrollWidth) + "px"; // marge
}
function normalizeId(str){
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // accents
        .replace(/[^a-z0-9_]/g, "_")    // tout sauf alphanum + _
        .replace(/_+/g, "_")            // éviter ___
        .replace(/^_|_$/g, "");         // trim _
}
async function supprimerNoeud(){
    await window.electronAPI.deleteNode(arbreId, nodeId);
    window.location.href = `editeur.html?arbre=${arbreId}`;

}