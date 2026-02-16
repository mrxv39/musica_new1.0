import sys, json
if __name__ == '__main__':
    # Dummy stub
    image = sys.argv[sys.argv.index('--image')+1] if '--image' in sys.argv else ''
    result = {'names': ['player1', 'player2']}
    print(json.dumps(result))