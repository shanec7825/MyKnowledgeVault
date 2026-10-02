# -*- coding: utf-8 -*-
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

def create_drawing_preview(file_path, output_path):
    """Create a visual preview card for each Excalidraw file"""
    content = Path(file_path).read_text(encoding='utf-8')
    
    # Extract info
    match = re.search(r'```compressed-json\s+(.+?)\s+```', content, re.DOTALL)
    compressed_size = len(match.group(1).strip()) if match else 0
    
    # Create preview image
    width = 800
    height = 600
    
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    # Header
    draw.rectangle([0, 0, width, 80], fill='#667eea')
    
    # File name
    filename = Path(file_path).stem
    draw.text((20, 25), filename, fill='white')
    
    # Determine complexity and color
    if compressed_size < 300:
        complexity = 'Empty Canvas'
        color = '#9e9e9e'
        elements = '0'
    elif compressed_size < 5000:
        complexity = 'Simple Drawing'
        color = '#4caf50'
        elements = '5-20'
    elif compressed_size < 20000:
        complexity = 'Medium Drawing'
        color = '#2196f3'
        elements = '20-100'
    elif compressed_size < 100000:
        complexity = 'Complex Drawing'
        color = '#ff9800'
        elements = '100-500'
    else:
        complexity = 'Very Complex Drawing'
        color = '#f44336'
        elements = '500+'
    
    # Draw canvas preview area
    canvas_y = 120
    canvas_height = 350
    
    # Draw grid background
    for i in range(0, width, 40):
        draw.line([i, canvas_y, i, canvas_y + canvas_height], fill='#f0f0f0', width=1)
    for i in range(canvas_y, canvas_y + canvas_height, 40):
        draw.line([0, i, width, i], fill='#f0f0f0', width=1)
    
    # Draw placeholder shapes based on complexity
    if complexity != 'Empty Canvas':
        # Draw some placeholder shapes
        import random
        random.seed(hash(filename))
        
        num_shapes = min(int(elements.split('-')[0]) if '-' in elements else 10, 15)
        
        for _ in range(num_shapes):
            shape_type = random.choice(['rect', 'ellipse', 'text'])
            x = random.randint(50, width - 150)
            y = random.randint(canvas_y + 30, canvas_y + canvas_height - 80)
            w = random.randint(60, 150)
            h = random.randint(40, 100)
            
            shape_color = random.choice(['#333333', '#667eea', '#764ba2', '#f093fb', '#4facfe'])
            
            if shape_type == 'rect':
                draw.rectangle([x, y, x + w, y + h], outline=shape_color, width=2)
            elif shape_type == 'ellipse':
                draw.ellipse([x, y, x + w, y + h], outline=shape_color, width=2)
            else:
                draw.text((x, y), 'Text', fill=shape_color)
    
    # Info section
    info_y = canvas_y + canvas_height + 30
    
    # Complexity badge
    draw.rectangle([20, info_y, 250, info_y + 40], fill=color)
    draw.text((35, info_y + 12), complexity, fill='white')
    
    # Stats
    draw.text((280, info_y + 5), f'Compressed Size: {compressed_size:,} chars', fill='#333')
    draw.text((280, info_y + 25), f'Estimated Elements: {elements}', fill='#666')
    
    # Bottom note
    draw.rectangle([20, height - 60, width - 20, height - 20], fill='#fff3cd', outline='#ffc107')
    draw.text((35, height - 48), 'Note: This is a preview. Actual drawing requires export from Obsidian.', fill='#856404')
    
    # Save
    img.save(output_path, 'PNG')
    return complexity, compressed_size

# Main
print("=" * 60)
print("Generating Excalidraw drawing previews...")
print("=" * 60)
print()

excalidraw_dir = Path("Excalidraw")
output_dir = Path("Excalidraw/exports/previews")
output_dir.mkdir(parents=True, exist_ok=True)

files = sorted(excalidraw_dir.glob("*.excalidraw.md"))

generated = []
for i, file_path in enumerate(files, 1):
    output_file = output_dir / f"{file_path.stem}_preview.png"
    complexity, size = create_drawing_preview(file_path, output_file)
    
    generated.append({
        'file': file_path.name,
        'preview': str(output_file),
        'complexity': complexity,
        'size': size
    })
    
    print(f"[{i}/{len(files)}] {file_path.name}")
    print(f"           {complexity} | {size:,} chars")
    print(f"           Preview: {output_file.name}")
    print()

# Create index page
index_html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Excalidraw Drawings Gallery</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        h1 { color: #333; }
        .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 30px; }
        .card { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .card img { width: 100%; height: 200px; object-fit: cover; }
        .card .info { padding: 15px; }
        .card h3 { margin: 0 0 10px 0; font-size: 14px; color: #333; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; color: white; }
    </style>
</head>
<body>
    <h1>Excalidraw Drawings Gallery</h1>
    <p>Click on any preview to see details</p>
    <div class="gallery">
"""

colors = {
    'Empty Canvas': '#9e9e9e',
    'Simple Drawing': '#4caf50',
    'Medium Drawing': '#2196f3',
    'Complex Drawing': '#ff9800',
    'Very Complex Drawing': '#f44336'
}

for item in generated:
    preview_rel = Path(item['preview']).relative_to('Excalidraw')
    color = colors.get(item['complexity'], '#9e9e9e')
    
    index_html += f"""
        <div class="card">
            <img src="exports/previews/{Path(item['preview']).name}" alt="{item['file']}">
            <div class="info">
                <h3>{item['file']}</h3>
                <span class="badge" style="background: {color}">{item['complexity']}</span>
                <p style="margin-top: 10px; color: #666; font-size: 12px;">{item['size']:,} compressed chars</p>
            </div>
        </div>
    """

index_html += """
    </div>
</body>
</html>
"""

Path("Excalidraw/gallery.html").write_text(index_html, encoding='utf-8')

print("=" * 60)
print("Done!")
print()
print(f"Generated {len(generated)} preview images")
print(f"Gallery page: Excalidraw/gallery.html")
print(f"Preview images: Excalidraw/exports/previews/")
print()
print("Open gallery.html in your browser to see all drawings!")
