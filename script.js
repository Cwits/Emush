const WIDTH = 960;
const HEIGHT = 160;          // реальные данные
const CANVAS_HEIGHT = 160;   // размер канваса
const ROW_LENGTH = 2048;
const DISPLAY_WIDTH_BYTES = 1920;

const pattern = [0xE7, 0xF3, 0xE7, 0xFF];

const DEFAULT_COLOR_PALLETE = {
    0:[0,0,0],         1:[30,30,30],     2:[127,127,127],   3:[255,255,255],
    4:[255,76,76],     5:[255,0,0],      6:[89,0,0],        7:[25,0,0],
    8:[255,189,108],   9:[255,84,0],     10:[89,29,0],      11:[25,8,0],
    12:[255,255,76],   13:[255,255,0],   14:[89,89,0],      15:[25,25,0],
    16:[136,255,76],   17:[84,255,0],    18:[29,89,0],      19:[8,25,0],
    20:[76,255,76],    21:[0,255,0],     22:[0,89,0],       23:[0,25,0],
    24:[76,255,136],   25:[0,255,84],    26:[0,89,29],      27:[0,25,8],
    28:[76,255,255],   29:[0,255,255],   30:[0,89,89],      31:[0,25,25],
    32:[76,136,255],   33:[0,84,255],    34:[0,29,89],      35:[0,8,25],
    36:[76,76,255],    37:[0,0,255],     38:[0,0,89],       39:[0,0,25],
    40:[136,76,255],   41:[84,0,255],    42:[29,0,89],      43:[8,0,25],
    44:[255,76,255],   45:[255,0,255],   46:[89,0,89],      47:[25,0,25],
    48:[255,76,136],   49:[255,0,84],    50:[89,0,29],      51:[25,0,8],
    52:[255,21,0],     53:[153,53,0],    54:[121,81,0],     55:[67,100,0], 
    56:[0,89,0],       57:[0,84,53],     58:[0,81,121],     59:[0,53,153], 
    60:[0,0,255],      61:[53,0,153],    62:[121,0,81],     63:[153,0,53],
    64:[255,0,0],      65:[189,255,45],  66:[138,255,0],    67:[0,255,0], 
    68:[0,255,189],    69:[0,189,255],   70:[0,138,255],    71:[0,0,255], 
    72:[189,0,255],    73:[255,0,189],   74:[255,0,138],    75:[255,189,189], 
    76:[255,234,189],  77:[255,255,189], 78:[234,255,189],  79:[189,255,189], 
    80:[189,255,234],  81:[189,255,255], 82:[189,234,255],  83:[189,189,255], 
    84:[234,189,255],  85:[255,189,255], 86:[255,189,234],  87:[255,102,102], 
    88:[255,153,102],  89:[255,255,102], 90:[153,255,102],  91:[102,255,102], 
    92:[102,255,153],  93:[102,255,255], 94:[102,153,255],  95:[102,102,255], 
    96:[153,102,255],  97:[255,102,255], 98:[255,102,153],  99:[204,0,0], 
    100:[204,102,0],   101:[204,204,0],  102:[102,204,0],   103:[0,204,0], 
    104:[0,204,102],   105:[0,204,204],  106:[0,102,204],   107:[0,0,204], 
    108:[102,0,204],   109:[204,0,204],  110:[204,0,102],   111:[153,153,153], 
    112:[115,115,115], 113:[77,77,77],   114:[38,38,38],    115:[255,64,64], 
    116:[255,128,64],  117:[255,255,64], 118:[128,255,64],  119:[64,255,64], 
    120:[64,255,128],  121:[64,255,255], 122:[64,128,255],  123:[64,64,255], 
    124:[128,64,255],  125:[255,64,255], 126:[255,64,128],  127:[0,0,0]
  };
  

//rgb buttons: 102-109, 20-27, 29, 36-43, 60-61, 85, 86, 89
const rgbButtons = [102, 103, 104, 105, 106, 107, 108, 109,
                    20, 21, 22, 23, 24, 25, 26, 27, 29, 
                    36, 37, 38, 39, 40, 41, 42, 43,
                    60, 61, 85, 86, 89];

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
      Pedal = 5,
      Pad = 6
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

        ctx.putImageData(img, 0, 0);
    } else if(type == 2) {
        //... button data
        const data = packet.data;
        
        const btnnum = data[0];
        const btn = "cc"+btnnum;
        const color = data[1];

        const el = document.getElementById(btn);
        if(!el) {
            console.log("cant find element " + btn);
            return;
        }
        if(rgbButtons.includes(btnnum)) {
            //its rgb
            if(color == 0) {
                // el.style.backgroundColor = "Black";
                el.style.setProperty("--pad-color", `rgb(${0},${0},${0})`);
            } else { 
                // el.style.backgroundColor = "Red";
                const rgb = DEFAULT_COLOR_PALLETE[color];
                const r = rgb[0];
                const g = rgb[1];
                const b = rgb[2];
                // el.style.backgroundColor = 'rgb(' + [r,g,b].join(',') + ')';
                el.style.setProperty("--pad-color", `rgb(${r},${g},${b})`);
            }
        } else {
            if(color == 0) {
                // el.style.backgroundColor = "Black";
                el.style.setProperty("--pad-color", `rgb(${0},${0},${0})`);
            } else {
                // el.style.backgroundColor = "White";
                el.style.setProperty("--pad-color", `rgb(${255},${255},${255})`);
            }   
        }

    } else if(type == 4) {
        //touchstrip data
    } else if(type == 6) {
        //pad data
        const data = packet.data;
        
        const btnnum = data[0];
        const btn = "nn"+btnnum;
        const color = data[1];

        const el = document.getElementById(btn);
        if(color == 0) {
            // el.style.backgroundColor = "Black";
            el.style.setProperty("--pad-color", 'rgb(${0},${0},${0})');
        } else { 
            // el.style.backgroundColor = "Red";
            const rgb = DEFAULT_COLOR_PALLETE[color];
            const r = rgb[0];
            const g = rgb[1];
            const b = rgb[2];
            // el.style.backgroundColor = 'rgb(' + [r,g,b].join(',') + ')';
            el.style.setProperty("--pad-color", `rgb(${r},${g},${b})`);
        }
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

// -------- WebSocket send callbacks ---------
function sendBtn(id,state){
    let header = new Uint8Array(8);
    header[0] = 2; //command
    header[1] = 2; //payload length
    header[2] = 0; header[3] = 0; header[4] = 0; 
    header[5] = 0; header[6] = 0; header[7] = 0;
    let payload = new Uint8Array(2);
    payload[0] = id;
    payload[1] = state;
    ws.send(header);
    ws.send(payload);
    console.log("Button %d state %d", id, state);
}

function sendPad(id, state) {
    let header = new Uint8Array(8);
    header[0] = 6; //command
    header[1] = 2; //payload length
    header[2] = 0; header[3] = 0; header[4] = 0;
    header[5] = 0; header[6] = 0; header[7] = 0;

    let payload = new Uint8Array(2);
    payload[0] = id;
    payload[1] = state;
    ws.send(header);
    ws.send(payload);
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