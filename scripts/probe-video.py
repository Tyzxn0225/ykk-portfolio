"""不依赖 ffmpeg，直接解析 MP4 容器读取时长 / 分辨率 / 帧率 / 编码。"""
import struct
import sys


def parse(path):
    data = open(path, "rb").read()
    size = len(data)
    info = {"size": size, "video": None, "audio": [], "brand": None}

    def walk(start, end, depth=0, path_str=""):
        pos = start
        while pos + 8 <= end:
            box_size, box_type = struct.unpack(">I4s", data[pos : pos + 8])
            box_type = box_type.decode("latin1")
            header = 8
            if box_size == 1:
                box_size = struct.unpack(">Q", data[pos + 8 : pos + 16])[0]
                header = 16
            elif box_size == 0:
                box_size = end - pos
            if box_size < header or pos + box_size > end:
                return
            body = pos + header
            box_end = pos + box_size
            full = path_str + "/" + box_type

            if box_type == "ftyp":
                info["brand"] = data[body : body + 4].decode("latin1")
            elif box_type == "mvhd":
                ver = data[body]
                off = body + 4
                if ver == 1:
                    ts, dur = struct.unpack(">IQ", data[off : off + 12])
                else:
                    ts, dur = struct.unpack(">II", data[off : off + 8])
                if ts:
                    info["duration"] = dur / ts
            elif box_type == "tkhd":
                ver = data[body]
                off = body + 4
                if ver == 1:
                    off += 16
                else:
                    off += 8
                off += 8  # reserved + layer/alt/volume
                off += 4  # reserved
                # 3x3 matrix (36 bytes)
                off += 36
                w, h = struct.unpack(">II", data[off : off + 8])
                info.setdefault("tkhd_dims", []).append((w / 65536.0, h / 65536.0))
            elif box_type == "mdhd":
                ver = data[body]
                off = body + 4
                if ver == 1:
                    ts, dur = struct.unpack(">IQ", data[off : off + 12])
                else:
                    ts, dur = struct.unpack(">II", data[off : off + 8])
                if ts:
                    info.setdefault("mdhd", []).append(dur / ts)
            elif box_type == "hdlr":
                handler = data[body + 8 : body + 12].decode("latin1")
                info.setdefault("handlers", []).append(handler)
            elif box_type == "stsd":
                count = struct.unpack(">I", data[body + 4 : body + 8])[0]
                off = body + 8
                for _ in range(count):
                    if off + 16 > box_end:
                        break
                    esize, etype = struct.unpack(">I4s", data[off : off + 8])
                    etype = etype.decode("latin1")
                    if etype == "avc1":
                        w, h = struct.unpack(">HH", data[off + 32 : off + 36])
                        info["video"] = {"codec": "H.264 (avc1)", "w": w, "h": h}
                    elif etype == "hvc1" or etype == "hev1":
                        w, h = struct.unpack(">HH", data[off + 32 : off + 36])
                        info["video"] = {"codec": "H.265 (HEVC)", "w": w, "h": h}
                    elif etype == "vp09":
                        w, h = struct.unpack(">HH", data[off + 32 : off + 36])
                        info["video"] = {"codec": "VP9", "w": w, "h": h}
                    elif etype == "av01":
                        w, h = struct.unpack(">HH", data[off + 32 : off + 36])
                        info["video"] = {"codec": "AV1", "w": w, "h": h}
                    elif etype == "mp4a":
                        info["audio"].append("AAC")
                    elif etype == "ac-3":
                        info["audio"].append("AC-3")
                    off += max(esize, 8)
            elif box_type in ("moov", "trak", "mdia", "minf", "stbl", "edts", "mvex", "udta"):
                walk(body, box_end, depth + 1, full)
            pos = box_end

    walk(0, size)
    return info


if __name__ == "__main__":
    p = sys.argv[1]
    i = parse(p)
    print(f"文件大小 : {i['size']/1024/1024:.2f} MB")
    print(f"容器品牌 : {i.get('brand')}")
    print(f"时长     : {i.get('duration', 0):.2f} 秒")
    v = i["video"]
    if v:
        print(f"视频编码 : {v['codec']}")
        print(f"分辨率   : {v['w']} x {v['h']}  (比例 {v['w']/v['h']:.2f})")
    print(f"音轨     : {i['audio'] or '无'}")
    mds = i.get("mdhd", [])
    if len(mds) > 1:
        print(f"轨道时长 : {[round(x,2) for x in mds]}")
    if i.get("tkhd_dims"):
        print(f"轨道尺寸 : {[(round(w),round(h)) for w,h in i['tkhd_dims']]}")
