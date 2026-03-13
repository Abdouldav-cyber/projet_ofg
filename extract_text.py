import xml.etree.ElementTree as ET
import sys

def extract_text(xml_file, output_file):
    try:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        # Word XML namespaces
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        text = []
        for p in root.findall('.//w:p', ns):
            para_text = []
            for t in p.findall('.//w:t', ns):
                if t.text:
                    para_text.append(t.text)
            if para_text:
                text.append(" ".join(para_text))
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("\n".join(text))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_text(sys.argv[1], sys.argv[2])
