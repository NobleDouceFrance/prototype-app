const url_catalogue="https://raw.githubusercontent.com/NobleDouceFrance/prototype-app//main/catalogue/catalogue.json";

async function initCatalogue(){
    console.log("catalogue en chargement");
    try{
        const res = await fetch(url_catalogue);
        const data = await res.json();

        afficherCatalogue(data.arbres);

    }catch(e){
        console.error("Erreur catalogue", e);
    }
}
initCatalogue();
async function afficherCatalogue(arbres){
    const container = document.getElementById("listeCatalogue");
    container.innerHTML = "";
    // 🔥 charger une seule fois
    const index = await window.electronAPI.loadIndex();

    const installedIds = [
        ...(index.arbres || []).map(a => a.id),
        ...(index.creations || []).map(a => a.id)
    ];

    for (const arbre of arbres){
        if (installedIds.includes(arbre.id)){
            continue;
        }
        // affichage normal
        const card = document.createElement("div");
        card.classList.add("tree-card");

        const title = document.createElement("h3");
        title.textContent = arbre.title;

        const desc = document.createElement("p");
        desc.textContent = arbre.description;

        const btn = document.createElement("button");
        btn.textContent = "Télécharger";

        btn.onclick = () => {
            btn.textContent="En cours...";
            const res=telechargerArbre(arbre);
            if (res){
                btn.disabled=true;
                btn.textContent="Installé ✅";
            }
            
        };
        card.appendChild(btn);
        card.appendChild(title);
        card.appendChild(desc);
        
        container.appendChild(card);
    }
}
async function telechargerArbre(arbre){
    console.log(arbre,arbre.folder);
    try{
        if (await isArbreInstalle(arbre.id)){
            alert("Déjà installé");
            return;
        }
        
        await window.electronAPI.downloadAndInstall(arbre.zip, arbre.folder);

        const res =await ajouterDansIndex(arbre);

        alert("Installé ✔");
        return res;
    }catch(e){
        console.error(e);
        alert("Erreur téléchargement");
        return false; 
    }
}
async function ajouterDansIndex(arbre){
    console.log(arbre);
    const data = await window.electronAPI.loadIndex();

    if(data.arbres.some(a => a.id === arbre.id)){
        alert("Déjà installé");
        return;
    }

    if(!data.arbres) data.arbres = [];

    if(!data.arbres.find(a => a.id === arbre.id)){
        if (!arbre.root){
            arbre.root="root";
        }
        data.arbres.push({
            id: arbre.id,
            title: arbre.title,
            folder: arbre.folder,
            root:arbre.root,
            version:arbre.version,
            description:arbre.description,
            file:arbre.file,
            nb_noeud:arbre.nb_noeud
        });
    }
    await window.electronAPI.saveIndex(data);
}
async function isArbreInstalle(id){
    const index = await window.electronAPI.loadIndex();

    return (
        (index.arbres || []).some(a => a.id === id) ||
        (index.creations || []).some(a => a.id === id)
    );
}
