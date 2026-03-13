import os

def sanitize_file(filepath):
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Décodage en ignorant les erreurs pour identifier les coupables
        # ou remplacement par des équivalents ASCII
        text = content.decode('utf-8', errors='ignore')
        
        # On réécrit en forçant l'encodage UTF-8 propre
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Nettoyé : {filepath}")
    except Exception as e:
        print(f"Erreur sur {filepath} : {e}")

# Parcours du projet
backend_dir = r"c:\Users\ASUS\Desktop\Projet_OFG\backend\core-service\app"
files_to_clean = [
    r"c:\Users\ASUS\Desktop\Projet_OFG\backend\core-service\main.py",
    r"c:\Users\ASUS\Desktop\Projet_OFG\infra\init-db\01-init.sql"
]

for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(('.py', '.sql', '.txt', '.yml', '.yaml')):
            files_to_clean.append(os.path.join(root, file))

for f in files_to_clean:
    if os.path.exists(f):
        sanitize_file(f)
