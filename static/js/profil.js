let profile = null;
let progress = null;
let index = null;

window.addEventListener("DOMContentLoaded", async () => {
    await chargerDonnees();
    afficherProfil();
    initialiserEvents();
});
async function chargerDonnees(){
    profile = await window.electronAPI.loadProfile();
    progress = await window.electronAPI.loadProgress();
    index = await window.electronAPI.loadIndex();
}
function afficherProfil(){
    afficherPseudo();
    afficherId();
    afficherDateInscription();
    afficherStatsLecture();
    afficherStatsCreations();
}
function afficherPseudo(){
    const inputPseudo = document.getElementById("inputPseudo");
    inputPseudo.placeholder="Inconnu";
    inputPseudo.value = profile.pseudo || "";
}
function afficherId(){
    const labelUserId = document.getElementById("labelUserId");
    if(profile.id){
        labelUserId.textContent = profile.id;
    }
    else{
        labelUserId.textContent = "Aucun ID";
    }
}
function afficherDateInscription(){
    const labelCreatedAt =document.getElementById("labelCreatedAt");
    const date = new Date(profile.created_at);
    const jour = String(date.getDate()).padStart(2, "0");
    const mois = String(date.getMonth() + 1).padStart(2, "0");
    const annee = date.getFullYear();
    labelCreatedAt.textContent =`Inscrit depuis le : ${jour}/${mois}/${annee}`;
}
function afficherStatsLecture(){
    const labelLecture =document.getElementById("labelLecture");
    const arbres = index.arbres || [];
    const nbArbres = arbres.length;
    let nbTermines = 0;
    for(const arbre of arbres){
        const arbreProgress =progress.arbres?.[arbre.id];
        if(!arbreProgress) continue;
        const nodes = arbreProgress.nodes || {};
        const valeurs = Object.values(nodes);
        if(valeurs.length === 0) continue;
        const toutValide =valeurs.every(n => n.validated === true);
        if(toutValide){
            nbTermines++;
        }
    }
    const pourcentage =
        nbArbres === 0
            ? 0
            : Math.round((nbTermines / nbArbres) * 100);
    labelLecture.textContent =`Lecture : ${nbArbres} arbre(s) | ${pourcentage}% terminés`;
}
async function afficherStatsCreations(){
    const labelCreations =document.getElementById("labelCreations");
    const creations = index.creations || [];
    let totalNoeuds = 0;
    for(const arbre of creations){
        try{
            const arbreIndex =await window.electronAPI.loadIndexArbre(arbre.folder || arbre.id);
            if(arbreIndex.nb_noeuds){
                totalNoeuds += arbreIndex.nb_noeuds;
            }
        }catch(e){
            console.error("Erreur chargement arbre :",arbre,e);
        }
    }
    labelCreations.textContent =`Créations : ${creations.length} arbre(s) | ${totalNoeuds} noeud(s)`;
}
function initialiserEvents(){
    const btnSavePseudo =document.getElementById("btnSavePseudo");
    btnSavePseudo.onclick = async () => {
        const inputPseudo =document.getElementById("inputPseudo");
        profile.pseudo = inputPseudo.value.trim();
        await sauvegarderProfil();
        alert("Pseudo sauvegardé");
    };
    const btnSetId =document.getElementById("btnSetId");
    btnSetId.onclick = async () => {
        const id = prompt("Entrer votre ID utilisateur");
        if(!id) return;
        profile.id = id.trim();
        await sauvegarderProfil();
        afficherId();
        alert("ID enregistré")
    };
}
async function sauvegarderProfil(){
    await window.electronAPI.saveProfile(profile);
}
