import asyncio
from aiohttp import web
import socket

WS_CLIENTS = set()
TCP_CLIENTS = set()

TCP_HOST = "0.0.0.0"
TCP_PORT = 9000


# ---------- TCP listener ----------
async def tcp_task():
    loop = asyncio.get_event_loop()

    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind((TCP_HOST, TCP_PORT))
    server_sock.listen()
    server_sock.setblocking(True)  # блокируем для executor

    print(f"TCP server listening on {TCP_HOST}:{TCP_PORT}")

    while True:
        # вызываем блокирующий accept в executor
        conn, addr = await loop.run_in_executor(None, server_sock.accept)
        print("TCP client connected:", addr)
        conn.setblocking(True)  # неблокирующий для recv
        asyncio.create_task(handle_tcp_client(conn, addr))

async def recv_exact(reader, size):
    buf = b''
    while len(buf) < size:
        chunk = await reader.read(size - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf

async def handle_tcp_client(reader, writer):
    addr = writer.get_extra_info("peername")
    print("TCP client connected:", addr)

    TCP_CLIENTS.add(writer)

    try:
        while True:
            header = await recv_exact(reader, 8)
            if not header:
                print("TCP client disconnected:", addr)
                break

            cmdType = header[0]
            dataSize = int.from_bytes(header[1:5], "little")
            magic = header[5:9]

            #if int.from_bytes(magic, 'big') == 0xADBECF:
            if magic != b'\xAD\xBE\xCF':
                print(f"broken magic {magic}")
                print(f"received broken magic in header {header}")

            data = await recv_exact(reader, dataSize)
            if data is None:
                break

                # print(f"received {len(fb)} bytes")

            frameEnd = await recv_exact(reader, 3)
            if frameEnd != b'\xAD\xBE\xCF':
                print(f"received broken magic after data {frameEnd}")
                continue

            # рассылка браузерам
            for ws in list(WS_CLIENTS):
                if not ws.closed:
                    await ws.send_bytes(header)
                    await ws.send_bytes(data)
                    await ws.send_bytes(frameEnd)
                    # await ws.send_bytes(fb)
            
            '''
            if cmdType == 1:
                # print(f"received framebuffer data, len={dataSize}")

                fb = await recv_exact(reader, dataSize)
                if fb is None:
                    break

                # print(f"received {len(fb)} bytes")

                frameEnd = await recv_exact(reader, 3)
                if frameEnd != b'\xAD\xBE\xCF':
                    print(f"received broken magic after data {frameEnd}")
                    continue

                if len(fb) != dataSize:
                    print(f"wrong fb size {len(fb)} != {dataSize}")
                    continue

                # рассылка браузерам
                for ws in list(WS_CLIENTS):
                    if not ws.closed:
                        await ws.send_bytes(header)
                        await ws.send_bytes(fb)
                        await ws.send_bytes(frameEnd)
                        # await ws.send_bytes(fb)
            elif cmdType == 2:
                #button data
                continue
            elif cmdType == 4:
                #touchstrip data
                continue
            elif cmdType == 6:
                #pad data
                continue
            '''
    except Exception as e:
        print("TCP error:", addr, e)

    finally:
        TCP_CLIENTS.remove(writer)
        writer.close()
        await writer.wait_closed()
        print("TCP connection closed:", addr)

async def send_to_tcp(payload: bytes):
    # packet = bytes([cmd]) + len(payload).to_bytes(4, "little") + payload

    for w in list(TCP_CLIENTS):
        try:
            # w.write(packet)
            w.write(payload)
            await w.drain()
        except:
            TCP_CLIENTS.remove(w)

# ---------- websocket ----------
async def ws_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    WS_CLIENTS.add(ws)
    print("Browser connected")
    conndata = bytes([7, 1, 0, 0, 0, 0, 0, 0]) #system(7), push connected(1)
    await send_to_tcp(conndata)
    data = bytes([1])
    await send_to_tcp(data)

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.BINARY:
                # здесь можно отправлять события обратно на TCP клиент
                # print(f"Received data from ws {msg}")
                await send_to_tcp(msg.data)
    finally:
        conndata = bytes([7, 1, 0, 0, 0, 0, 0, 0]) #system(7), push connected(1)
        disconndata = bytes([2]) #system(7), push disconnected(2)
        await send_to_tcp(conndata)
        await send_to_tcp(disconndata)
        WS_CLIENTS.remove(ws)
        print("Browser disconnected")

    return ws


# ---------- http ----------
async def index(request):
    return web.FileResponse("index.html")
    
async def script(request):
    return web.FileResponse("script.js")
    
async def styles(request):
    return web.FileResponse("styles.css")

async def start_tcp_server(app):
    server = await asyncio.start_server(
        handle_tcp_client,
        TCP_HOST,
        TCP_PORT
    )

    app["tcp_server"] = server
    print(f"TCP server listening on {TCP_HOST}:{TCP_PORT}")


# ---------- app startup ----------
app = web.Application()
app.router.add_get("/", index)
# app.router.add_static("/", ".")
app.router.add_get("/script.js", script)
app.router.add_get("/styles.css", styles)
app.router.add_get("/ws", ws_handler)



async def startup(app):
    # запускаем TCP listener
    await start_tcp_server(app)


app.on_startup.append(startup)

web.run_app(app, port=8080)
