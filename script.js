const WIDTH = 960;
const HEIGHT = 160;          // реальные данные
const CANVAS_HEIGHT = 180;   // размер канваса
const ROW_LENGTH = 2048;
const DISPLAY_WIDTH_BYTES = 1920;

const pattern = [0xE7, 0xF3, 0xE7, 0xFF];

const ws = new WebSocket("ws://" + location.host + "/ws");
ws.binaryType = "arraybuffer";

const fb = document.getElementById("fb");
const ctx = fb.getContext("2d");
const img = ctx.createImageData(960,180);

let packet = {
    header: null,
    data: null,
    footer: null
};

function processPacket(packet) {
    const type = packet.header[0]
    /*
      DisplayFrame = 1,
      Button = 2,
      Encoder = 3,
      Touchstrip = 4,
      Pedal = 5
    */
    if(type == 1) {
        //display frame buffer
        
        const buf = packet.data;
        const out = img.data;

        let outIndex = 0;

        for (let y = 0; y < HEIGHT; y++) {

            let patIdx = 0;
            const rowStart = y * ROW_LENGTH;

            for (let x = 0; x < WIDTH; x++) {

                const i = rowStart + x * 2;

                // снимаем XOR
                const LSB = buf[i]     ^ pattern[(patIdx++) & 3];
                const MSB = buf[i + 1] ^ pattern[(patIdx++) & 3];

                const pixel = (MSB << 8) | LSB;

                const r = (pixel >> 11) & 0x1F;
                const g = (pixel >> 5)  & 0x3F;
                const b = pixel & 0x1F;

                out[outIndex++] = (r << 3) | (r >> 2);
                out[outIndex++] = (g << 2) | (g >> 4);
                out[outIndex++] = (b << 3) | (b >> 2);
                out[outIndex++] = 255;
            }
        }

        // если canvas выше буфера — можно зачистить низ
        for (let y = HEIGHT; y < CANVAS_HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const i = (y * WIDTH + x) * 4;
                out[i] = 0;
                out[i+1] = 0;
                out[i+2] = 0;
                out[i+3] = 255;
            }
        }

        ctx.putImageData(img, 0, 0);
    } else if(type == 2) {
        //...
    }
}

// -------- receive ----------
ws.onmessage = (ev) => {
    const d = new Uint8Array(ev.data);

    // если заголовок ещё не получен
    if (!packet.header) {
        packet.header = d;

        const type = d[0];

        // читать uint32 little-endian
        const dataLen =
            (d[4] << 24) |
            (d[3] << 16) |
            (d[2] << 8)  |
            d[1];

        packet.type = type;
        packet.expectedLen = dataLen;

        const magic = (d[5] << 16) | (d[6] << 8) | d[7];
        // console.log("magic %s", magic.toString(3));

        // console.log("header received", packet);
        return;
    }

    // если получили данные
    if (!packet.data) {
        packet.data = d;
        // console.log("data received");
        return;
    }

    // если получили концовку
    packet.footer = d;
    // console.log("footer received");

    // 👉 теперь пакет собран
    processPacket(packet);

    // сбрасываем
    packet = { header: null, data: null, footer: null };
};

function sendBtn(id,state){
    // ws.send(new Uint8Array([0x10,id,state]));
    console.log("Button %d state %d", id, state);
}

function sendPad(id, state) {
    //state 0 - released, 1 - pressed
    console.log("Pad %d state %d", id, state);
}

// -------- buttons ----------
function btnDown(btn) {
    let num = parseInt(btn.replace("cc", ""), 10); // убираем "nn" и превращаем в число
    // console.log("Pad number:", num);
    sendBtn(num, 1);
    // console.log("%s pressed", btn);
}

function btnUp(btn) {
    let num = parseInt(btn.replace("cc", ""), 10); // убираем "nn" и превращаем в число
    // console.log("Pad number:", num);
    sendBtn(num, 0);
    // console.log("%s released", btn);
}

for(let i=1; i<=127; ++i) {
    const name = "cc"+i;
    const el = document.getElementById(name);

    if(!el) continue;
    //get rid of encoders
    if(i == 14 || i == 15 || (i >= 71 && i <= 79)) continue;

    el.addEventListener("mousedown", e => btnDown(e.target.id));
    el.addEventListener("mouseup", e => btnUp(e.target.id));

}

// --------- Pads -----------
function padDown(pad) {
    let num = parseInt(pad.replace("nn", ""), 10); // убираем "nn" и превращаем в число
    // console.log("Pad number:", num);
    sendPad(num, 1);
    // console.log("pad %s pressed", pad)
}

function padUp(pad) {
    let num = parseInt(pad.replace("nn", ""), 10); // убираем "nn" и превращаем в число
    // console.log("Pad number:", num);
    sendPad(num, 0);
    // console.log("pad %s pressed", pad)
}

for(let i=36; i<=99; ++i) {
    let name = "nn"+i;
    document.getElementById(name).addEventListener("mousedown", e => padDown(e.target.id));
    document.getElementById(name).addEventListener("mouseup", e => padUp(e.target.id));
}

// -------- encoder drag ----------
// let dragging=false;
// let lastX=0;

// fb.onmousedown=(e)=>{
//     dragging=true;
//     lastX=e.clientX;
// };
// window.onmouseup=()=>dragging=false;

// window.onmousemove=(e)=>{
//     if(!dragging) return;
//     let dx=e.clientX-lastX;
//     lastX=e.clientX;

//     if(Math.abs(dx)>3){
//         ws.send(new Int8Array([0x11,0,dx>0?1:-1]));
//     }
// };


// -------- touchstrip ----------
/*const t=document.getElementById("touch");

t.onclick=(e)=>{
    const r=t.getBoundingClientRect();
    const y=(e.clientY-r.top)/r.height;
    const v=1-(y*2);

    const buf=new ArrayBuffer(5);
    const dv=new DataView(buf);
    dv.setUint8(0,0x12);
    dv.setFloat32(1,v,true);
    ws.send(buf);
};*/