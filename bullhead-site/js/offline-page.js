/* Bullhead offline page: Try again button, auto-reload when back online, Swahili text. */
document.getElementById("r").addEventListener("click",function(){location.reload()});
window.addEventListener("online",function(){location.reload()});
try{if(localStorage.getItem("bullheadLang")==="sw"){
document.getElementById("h").textContent="Hauna mtandao";
document.getElementById("t").textContent="Hakuna mtandao sasa. Kurasa ulizofungua tayari bado zinafanya kazi, unaweza kuona menyu na kupanga oda yako. Kutuma oda kunahitaji mtandao, au piga simu.";
document.getElementById("c").textContent="Piga simu";document.getElementById("m").textContent="Fungua menyu";document.getElementById("r").textContent="Jaribu tena";
document.getElementById("s").textContent="You are offline. Call us or try again."}}catch(e){}
