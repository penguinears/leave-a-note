import { firebaseConfig } from "./images/firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  update,
  query,
  limitToLast
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);
const notesRef = ref(db, "notes");

const notesQuery = query(notesRef, limitToLast(200));

const home = document.getElementById("home");
const addBtn = document.getElementById("addNoteBtn");
const map = document.getElementById("map");
const mapContainer = document.getElementById("map-container");
const editor = document.getElementById("editor");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const colorPicker = document.getElementById("colorPicker");
const fontSize = document.getElementById("fontSize");

let tool = "draw";
let drawing = false;
let placing = false;
let preview = null;
let noteImage = null;
let lastTap = 0;
let draggingPreview = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

function enterApp() {
  home.classList.add("hidden");
  addBtn.style.display = "block";
}

home.addEventListener("click", enterApp);
home.addEventListener("touchstart", enterApp);

addBtn.onclick = () => {
  editor.style.display = "flex";
  addBtn.style.display = "none";
  mapContainer.classList.add("faded");

  const img = new Image();
  img.src = "images/Untitled design.jpg";

  img.onload = () => {
    ctx.clearRect(0, 0, 500, 500);
    ctx.drawImage(img, 0, 0, 500, 500);
  };
};

document.getElementById("cancelBtn").onclick = () => {
  editor.style.display = "none";
  addBtn.style.display = "block";
  mapContainer.classList.remove("faded");
};

window.setTool = t => tool = t;

/* ---------------- DRAW ---------------- */

canvas.onpointerdown = e => {
  drawing = true;
  const r = canvas.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
};

canvas.onpointermove = e => {
  if (!drawing) return;
  const r = canvas.getBoundingClientRect();

  if (tool === "erase") {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = colorPicker.value;
  }

  let scale = parseInt(fontSize.value || "24", 10) / 24;

  ctx.lineWidth = (tool === "erase" ? 25 : 3) * scale;

  ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
  ctx.stroke();
};

canvas.onpointerup = () => {
  drawing = false;
  ctx.globalCompositeOperation = "source-over";
};



canvas.onclick = e => {
  if (tool !== "text") return;

  let text = prompt("Text:");
  if (!text) return;

  let size = parseInt(fontSize.value);
  const maxW = 420;
  const maxH = 420;

  function wrap(text, size) {
    ctx.font = size + "px Arial";
    let words = text.split(" ");
    let lines = [];
    let line = "";

    for (let w of words) {
      let test = line + w + " ";
      if (ctx.measureText(test).width > maxW) {
        lines.push(line);
        line = w + " ";
      } else {
        line = test;
      }
    }
    lines.push(line);
    return lines;
  }

  let lines = wrap(text, size);

  while ((lines.length * size > maxH || Math.max(...lines.map(l => ctx.measureText(l).width)) > maxW) && size > 10) {
    size--;
    lines = wrap(text, size);
  }

  ctx.font = size + "px Arial";
  ctx.fillStyle = colorPicker.value;

  let y = e.offsetY;

  lines.forEach(l => {
    ctx.fillText(l.trim(), e.offsetX, y);
    y += size;
  });
};



window.finishNote = () => {
  editor.style.display = "none";
  addBtn.style.display = "block";
  mapContainer.classList.remove("faded");

  
  noteImage = canvas.toDataURL("image/webp", 0.6);

  placing = true;

  preview = document.createElement("img");
  preview.src = noteImage;
  preview.className = "note";
  preview.style.opacity = 0.5;
  map.appendChild(preview);

  preview.onpointerdown = e => {
    draggingPreview = true;
    const rect = preview.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
  };

  preview.onpointerup = () => {
    draggingPreview = false;
  };
};

function getPos(x, y) {
  const rect = map.getBoundingClientRect();
  return {
    x: x - rect.left + mapContainer.scrollLeft,
    y: y - rect.top + mapContainer.scrollTop
  };
}

mapContainer.addEventListener("pointermove", e => {
  if (!placing || !preview) return;

  let p = getPos(e.clientX, e.clientY);

  if (draggingPreview) {
    preview.style.left = (p.x - dragOffsetX) + "px";
    preview.style.top = (p.y - dragOffsetY) + "px";
  } else {
    preview.style.left = (p.x - 85) + "px";
    preview.style.top = (p.y - 85) + "px";
  }
});

mapContainer.addEventListener("click", e => {
  if (!placing) return;
  placeFinal(getPos(e.clientX, e.clientY));
});

function placeFinal(p) {
  const r = push(notesRef);

  const data = {
    x: p.x - 85,
    y: p.y - 85,
    image: noteImage,
    created: Date.now(),
    reported: false
  };

  set(r, data);

  createNote(r.key, data);

  placing = false;
  draggingPreview = false;

  if (preview) preview.remove();
}



function createNote(id, d) {
  if (document.getElementById(id)) return; // avoid duplicates

  const n = document.createElement("div");
  n.className = "note";
  n.id = id;
  n.dataset.id = id;

  n.style.left = d.x + "px";
  n.style.top = d.y + "px";

  const bg = document.createElement("img");
  bg.src = "images/note-removebg-preview.png";

  const content = document.createElement("img");
  content.src = d.image;

  const flag = document.createElement("div");
  flag.className = "reportBtn";
  flag.innerHTML = '<i class="fa-solid fa-flag" style="color:red;"></i>';

  flag.onclick = e => {
    e.stopPropagation();
    update(ref(db, "notes/" + id), { reported: true });
  };

  n.onclick = () => {
    n.classList.toggle("zoom");

    let tag = n.querySelector(".dateTag");

    if (n.classList.contains("zoom")) {
      if (!tag) {
        tag = document.createElement("div");
        tag.className = "dateTag";
        tag.innerText = new Date(d.created).toLocaleDateString();
        n.appendChild(tag);
      }
    } else {
      if (tag) tag.remove();
    }
  };

  n.appendChild(bg);
  n.appendChild(content);
  n.appendChild(flag);

  map.appendChild(n);
}

onValue(notesQuery, snap => {
  snap.forEach(c => {
    createNote(c.key, c.val());
  });
});
