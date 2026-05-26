import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const app = initializeApp({
  apiKey: "AIzaSyBzk5p9naKjZndFHfqpldxGUMLBGzkDIsU",
  authDomain: "antianti-69313.firebaseapp.com",
  databaseURL: "https://antianti-69313-default-rtdb.firebaseio.com",
  projectId: "antianti-69313",
  storageBucket: "antianti-69313.firebasestorage.app",
  messagingSenderId: "147709968684",
  appId: "1:147709968684:web:696108f146ecda9b5eec89",
  measurementId: "G-WXRNC9P09F"
});

const db = getDatabase(app);
const notesRef = ref(db, "notes");

const home = document.getElementById("home");
const addBtn = document.getElementById("addNoteBtn");
addBtn.innerText = "Write Note";

const map = document.getElementById("map");
const mapContainer = document.getElementById("map-container");
const editor = document.getElementById("editor");

const bgCanvas = document.getElementById("bgCanvas");
const bgCtx = bgCanvas.getContext("2d");

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
  img.onload = () => bgCtx.drawImage(img, 0, 0, 500, 500);
};

document.getElementById("cancelBtn").onclick = () => {
  editor.style.display = "none";
  addBtn.style.display = "block";
  mapContainer.classList.remove("faded");
};

window.setTool = t => tool = t;

canvas.onpointerdown = e => {
  drawing = true;
  const r = canvas.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
};

canvas.onpointermove = e => {
  if (!drawing) return;

  const r = canvas.getBoundingClientRect();

  let scaleFactor = parseInt(fontSize.value || "24", 10) / 24;

  if (tool === "erase") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 25 * scaleFactor;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = 3 * scaleFactor;
  }

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

  let maxW = 420, maxH = 420;
  let size = parseInt(fontSize.value);

  function wrap(ctx, text, size) {
    ctx.font = size + "px Arial";
    let words = text.split(" ");
    let lines = [], line = "";
    for (let w of words) {
      let test = line + w + " ";
      if (ctx.measureText(test).width > maxW) {
        lines.push(line);
        line = w + " ";
      } else line = test;
    }
    lines.push(line);
    return lines;
  }

  function hardWrap(lines, size) {
    let final = [];
    ctx.font = size + "px Arial";
    lines.forEach(l => {
      if (ctx.measureText(l).width <= maxW) {
        final.push(l);
      } else {
        let chunk = "";
        for (let i = 0; i < l.length; i++) {
          chunk += l[i];
          if (ctx.measureText(chunk).width > maxW) {
            final.push(chunk.slice(0, -1));
            chunk = l[i];
          }
        }
        if (chunk.trim().length > 0) final.push(chunk);
      }
    });
    return final;
  }

  let lines = wrap(ctx, text, size);

  if (Math.max(...lines.map(l => ctx.measureText(l).width)) > maxW) {
    lines = hardWrap(lines, size);
  }

  while ((lines.length * size > maxH ||
    Math.max(...lines.map(l => ctx.measureText(l).width)) > maxW) &&
    size > 10) {
    size--;
    lines = wrap(ctx, text, size);
    if (Math.max(...lines.map(l => ctx.measureText(l).width)) > maxW) {
      lines = hardWrap(lines, size);
    }
  }

  ctx.font = size + "px Arial";
  ctx.fillStyle = colorPicker.value;

  let startX = e.offsetX;
  let startY = e.offsetY;
  let y = startY;

  lines.forEach((l, i) => {
    let w = ctx.measureText(l.trim()).width;

    if (startX + w > 500) {
      startX = 10;
      y += size;
    }

    if (y + size > 500) {
      size--;
      ctx.font = size + "px Arial";
    }

    ctx.fillText(l.trim(), startX, y);
    y += size;
  });
};

window.finishNote = () => {
  editor.style.display = "none";
  addBtn.style.display = "block";
  mapContainer.classList.remove("faded");

  const merged = document.createElement("canvas");
  merged.width = 500;
  merged.height = 500;
  const mctx = merged.getContext("2d");

  mctx.drawImage(bgCanvas, 0, 0);
  mctx.drawImage(canvas, 0, 0);

  noteImage = merged.toDataURL();

  placing = true;

  preview = document.createElement("img");
  preview.src = noteImage;
  preview.className = "note";
  preview.style.opacity = 0.5;
  preview.style.touchAction = "none";
  map.appendChild(preview);

  preview.addEventListener("pointerdown", e => {
    if (!placing) return;
    draggingPreview = true;
    const rect = preview.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    preview.setPointerCapture(e.pointerId);
  });

  preview.addEventListener("pointerup", e => {
    draggingPreview = false;
    try { preview.releasePointerCapture(e.pointerId); } catch (err) { }
  });
};

function getPos(x, y) {
  const rect = map.getBoundingClientRect();
  return {
    x: x - rect.left + mapContainer.scrollLeft,
    y: y - rect.top + mapContainer.scrollTop
  };
}

mapContainer.addEventListener("mousemove", e => {
  if (!placing) return;
  let p = getPos(e.clientX, e.clientY);

  if (draggingPreview) {
    preview.style.left = (p.x - dragOffsetX + preview.offsetWidth / 2 - 85) + "px";
    preview.style.top = (p.y - dragOffsetY + preview.offsetHeight / 2 - 85) + "px";
  } else {
    preview.style.left = (p.x - 85) + "px";
    preview.style.top = (p.y - 85) + "px";
  }
});

mapContainer.addEventListener("touchstart", e => {
  if (!placing) return;
  const t = e.touches[0];
  const now = Date.now();
  let p = getPos(t.clientX, t.clientY);

  preview.style.left = (p.x - 85) + "px";
  preview.style.top = (p.y - 85) + "px";

  if (now - lastTap < 300) placeFinal(p);
  lastTap = now;
});

mapContainer.addEventListener("pointermove", e => {
  if (!placing || !draggingPreview) return;
  let p = getPos(e.clientX, e.clientY);
  preview.style.left = (p.x - dragOffsetX + preview.offsetWidth / 2 - 85) + "px";
  preview.style.top = (p.y - dragOffsetY + preview.offsetHeight / 2 - 85) + "px";
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
  createNote(r.key, data);
  update(r, data);
  placing = false;
  draggingPreview = false;
  if (preview) preview.remove();
}

function createNote(id, d) {
  const n = document.createElement("div");
  n.className = "note";
  n.dataset.id = id;
  n.id = "note-" + id;
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
    let existing = n.querySelector(".dateTag");
    if (n.classList.contains("zoom")) {
      if (!existing) {
        const tag = document.createElement("div");
        tag.className = "dateTag";
        tag.innerText = new Date(d.created).toLocaleDateString();
        n.appendChild(tag);
      }
    } else {
      if (existing) existing.remove();
    }
  };

  n.appendChild(bg);
  n.appendChild(content);
  n.appendChild(flag);
  map.appendChild(n);
}

document.getElementById("loadingNotes").classList.remove("hidden");

onValue(notesRef, snap => {
  const existing = new Set();

  snap.forEach(c => {
    existing.add(c.key);
    if (!document.getElementById("note-" + c.key)) {
      createNote(c.key, c.val());
    }
  });

  document.querySelectorAll(".note").forEach(n => {
    const id = n.dataset.id;
    if (!existing.has(id)) n.remove();
  });

  document.getElementById("loadingNotes").classList.add("hidden");
});
