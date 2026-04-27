chargerArbres();
async function chargerArbres(){
    const data =await window.electronAPI.loadIndex();
    const container = document.getElementById("listeArbres");
    container.innerHTML = "";

    data.creations.forEach(arbre => {
        const div = document.createElement("div");
        div.className = "arbre";

        const title = document.createElement("h3");
        title.textContent = arbre.title;

        const openBtn = document.createElement("button");
        openBtn.textContent = "✏️ Éditer";

        openBtn.onclick = () => {
            window.location.href =`editeur_noeud.html?arbre=${arbre.folder}&node=${arbre.root}`;
        };
        const exportBtn = document.createElement("button");
        exportBtn.textContent = "Exporter";

        const btnGraph = document.createElement("button");
        btnGraph.textContent = "Voir graphe";
            
        btnGraph.onclick = () => {
            if (btnGraph.textContent=="Voir graphe"){
                construireGraphe(arbre);
                btnGraph.textContent="replier l'arbre";
            }
            else{
                document.getElementById("graphContainer").style.display="none";
                btnGraph.textContent="Voir graphe";
            }
        };
            
        const btn_supr = document.createElement("button");
        btn_supr.textContent = "Supprimer";
        btn_supr.onclick=()=>{
            const confirmDelete = confirm(`Supprimer "${arbre.title}" ?`);
            if(!confirmDelete) return;
            window.electronAPI.deleteArbre(arbre.id);
            location.reload();
        }
        exportBtn.onclick = async () => {
            if(!arbre || !arbre.id){
                alert("Aucun arbre chargé");
                return;
            }
            if(window.electronAPI){
                console.log("Export ZIP en cours...");
                try{
                    const path = await window.electronAPI.exportZip(arbre.folder);
                    alert("Export terminé :\n" + path);
                    window.electronAPI.openExternal("https://github.com/ton-repo/");
                }catch(e){
                    console.error(e);
                    alert("Erreur export");
                }finally{
                    console.log("final");
                }
            }else{
                alert("Electron non disponible");
            }
        };
            div.appendChild(title);
            div.appendChild(openBtn);
            div.appendChild(exportBtn);
            div.appendChild(btnGraph);
            div.appendChild(btn_supr);

            container.appendChild(div);
        });
    }
document.getElementById("newTree").onclick = async () => {
    if (document.getElementById("popupCreate").style.display == "block"){
        document.getElementById("popupCreate").style.display = "none";
    }else {
        document.getElementById("popupCreate").style.display = "block"
    }
};
async function sauvegarderListe(data){
    if(window.electronAPI){
        await window.electronAPI.saveIndex(data);
    } else {
        console.log("Sauvegarde simulée :", data);
    }
    chargerArbres();
}
document.getElementById("importTree").onclick = () => {
    if (document.getElementById("popupImport").style.display == "block"){
        document.getElementById("popupImport").style.display = "none";
    }else {
        document.getElementById("popupImport").style.display = "block"
    }
};
document.getElementById("fileInput").onchange =async (e) => {
    const file = e.target.files[0];

    if(!file) return;

    const reader = new FileReader();

    reader.onload =async  () => {
        const content = JSON.parse(reader.result);
        const id = content.id || ("import_" + Date.now());

        const data = await window.electronAPI.loadIndex();

        if (!data.arbres) data.arbres = [];
        if (!data.creations) data.creations = [];

        data.arbres.push({
            id: id,
            title: content.title || "Importé",
            folder: id,
        });

        await window.electronAPI.saveIndex(data);

    };
    reader.readAsText(file);
    fermerPopup();
};
function fermerPopup(){
    document.getElementById("popupImport").style.display = "none";
}
async function construireGraphe(arbre){
    const niveaux = [];
    const visited = new Set();
    let courant = [arbre.root];
    while(courant.length > 0){
        const prochain = [];
        const niveauNodes = [];
        for(const id of courant){
            if(visited.has(id)) continue;

            visited.add(id);
            console.log(arbre.folder,id);
            const node = await window.electronAPI.loadNode(arbre.folder,id);
            niveauNodes.push({id,node});

            if(node.suivant){
                const enfants = Array.isArray(node.suivant)? node.suivant: [node.suivant];
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
    afficherArbre(arbre,niveaux);
}
async function afficherArbre(arbre,niveaux){
    const container = document.getElementById("graph");
    document.getElementById("graphContainer").style.display="block";
    container.innerHTML = "";
    for (const niveau of niveaux){
        const div = document.createElement("div");
        div.className = "niveau";
        for (const {id, node} of niveau){

            const link = document.createElement("a");
            link.href = `editeur_noeud.html?arbre=${arbre.id}&node=${id}`;
            link.textContent = node.title;

            const status = getStatus(node);
            if (status){
                link.style.color="green";
            }else{
                link.style.color="grey";
            }

            const box = document.createElement("div");
            box.className = "node";

            box.appendChild(link);
            div.appendChild(box);
        }
        container.appendChild(div);
    }
}
function getStatus(node){
    return node.validite === true;
}
function fermerPopupCreate(){
    document.getElementById("popupCreate").style.display = "none";
}
document.getElementById("confirmCreate").onclick = async () => {
    const input = document.getElementById("newTreeName");
    const name = input.value.trim();

    if(!name){
        alert("Nom invalide");
        return;
    }
    const id = name.toLowerCase().replace(/\s+/g,"_");

    try{
        if(window.electronAPI){
            await window.electronAPI.createTree(id, name);
        }
        fermerPopupCreate();
        location.reload();
    }catch(e){
        console.error(e);
        alert("Erreur création");
    }
};
