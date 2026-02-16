import sys, json
if __name__ == '__main__':
    # Dummy stub
    image = sys.argv[sys.argv.index('--image')+1] if '--image' in sys.argv else ''
    result = {'noboard_ok': True}
    print(json.dumps(result))