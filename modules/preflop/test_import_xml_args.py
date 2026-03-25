# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\test_import_xml_args.py
import argparse, os, glob, subprocess, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--folder", required=True)
    ap.add_argument("--hero", required=True)
    args = ap.parse_args()

    folder = args.folder
    hero = args.hero

    if not os.path.isdir(folder):
        print({"ok": False, "error": "folder_not_found", "folder": folder})
        return 2

    xmls = glob.glob(os.path.join(folder, "**", "*.xml"), recursive=True)
    if not xmls:
        print({"ok": False, "error": "no_xml_found", "folder": folder})
        return 2

    # verify import_xml.py exists and can show help
    import_script = os.path.join(os.path.dirname(__file__), "import_xml.py")
    if not os.path.isfile(import_script):
        print({"ok": False, "error": "import_xml_py_not_found", "path": import_script})
        return 2

    try:
        p = subprocess.run([sys.executable, import_script, "-h"], capture_output=True, text=True)
        if p.returncode != 0:
            print({"ok": False, "error": "import_xml_help_failed", "stderr": p.stderr[:400]})
            return 2
    except Exception as e:
        print({"ok": False, "error": "spawn_failed", "detail": str(e)})
        return 2

    print({"ok": True, "folder": folder, "hero": hero, "xml_count": len(xmls), "sample": os.path.basename(xmls[0])})
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
