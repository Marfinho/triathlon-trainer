"""Exportiert den realistischen Männerkörper als rohe Daten (Weltkoordinaten, m).
Ausgabe: body_L{level}.json mit positions (flach) und triangles (flach), dazu Augen."""
import bpy, sys, json

src = sys.argv[-2]
level = int(sys.argv[-1])
bpy.ops.wm.open_mainfile(filepath=src, load_ui=False, use_scripts=False)

def dump(obj, lv):
    for m in obj.modifiers:
        if m.type == "MULTIRES":
            m.levels = lv
            m.render_levels = lv
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    mw = obj.matrix_world
    pos = []
    for v in me.vertices:
        p = mw @ v.co
        pos += [round(p.x, 5), round(p.y, 5), round(p.z, 5)]
    tris = []
    for t in me.loop_triangles:
        tris += list(t.vertices)
    ev.to_mesh_clear()
    return {"positions": pos, "triangles": tris}

body = bpy.data.objects["GEO-body_male_realistic"]
out = {"body": dump(body, level)}
for side in ("L", "R"):
    out["eye_" + side] = dump(bpy.data.objects["GEO-body_male_realistic.eye." + side], 0)
with open(f"body_L{level}.json", "w") as f:
    json.dump(out, f)
print("verts", len(out["body"]["positions"]) // 3, "tris", len(out["body"]["triangles"]) // 3)
