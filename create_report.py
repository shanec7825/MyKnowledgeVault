# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def analyze_excalidraw(file_path):
    """Analyze Excalidraw file"""
    content = Path(file_path).read_text(encoding='utf-8')
    
    result = {
        'file': Path(file_path).name,
        'size_kb': round(len(content) / 1024, 1),
    }
    
    match = re.search(r'```compressed-json\s+(.+?)\s+```', content, re.DOTALL)
    if match:
        compressed_size = len(match.group(1).strip())
        result['compressed_kb'] = round(compressed_size / 1024, 1)
        
        # Determine complexity
        if compressed_size < 300:
            result['type'] = 'Empty Canvas'
            result['color'] = '#9e9e9e'
        elif compressed_size < 5000:
            result['type'] = 'Simple'
            result['color'] = '#4caf50'
        elif compressed_size < 20000:
            result['type'] = 'Medium'
            result['color'] = '#2196f3'
        elif compressed_size < 100000:
            result['type'] = 'Complex'
            result['color'] = '#ff9800'
        else:
            result['type'] = 'Very Complex'
            result['color'] = '#f44336'
    
    return result

def create_visual_report(results, output_path):
    """Create visual report image"""
    width = 1000
    header_height = 80
    row_height = 60
    padding = 20
    
    total_height = header_height + len(results) * row_height + padding * 3 + 100
    
    img = Image.new('RGB', (width, total_height), 'white')
    draw = ImageDraw.Draw(img)
    
    # Header
    draw.rectangle([0, 0, width, header_height], fill='#667eea')
    draw.text((30, 25), 'Excalidraw Files Analysis Report', fill='white')
    
    # Column headers
    y = header_height + padding
    draw.text((30, y), 'File Name', fill='#333')
    draw.text((500, y), 'Size', fill='#333')
    draw.text((650, y), 'Compressed', fill='#333')
    draw.text((800, y), 'Type', fill='#333')
    
    y += 30
    draw.line([30, y, width - 30, y], fill='#ddd', width=2)
    y += 10
    
    # File rows
    for result in results:
        # Alternating background
        if results.index(result) % 2 == 0:
            draw.rectangle([30, y - 5, width - 30, y + row_height - 10], fill='#f9f9f9')
        
        # File name
        name = result['file'][:40] + '...' if len(result['file']) > 40 else result['file']
        draw.text((30, y + 15), name, fill='#333')
        
        # Size
        draw.text((500, y + 15), f"{result['size_kb']} KB", fill='#666')
        
        # Compressed size
        draw.text((650, y + 15), f"{result.get('compressed_kb', 0)} KB", fill='#666')
        
        # Type badge
        badge_x = 800
        badge_width = 120
        draw.rectangle([badge_x, y + 10, badge_x + badge_width, y + 35], 
                      fill=result.get('color', '#9e9e9e'))
        draw.text((badge_x + 10, y + 15), result.get('type', 'Unknown'), fill='white')
        
        y += row_height
    
    # Summary box
    y += 20
    draw.rectangle([30, y, width - 30, y + 80], fill='#e3f2fd', outline='#2196f3')
    
    total_size = sum(r['size_kb'] for r in results)
    total_compressed = sum(r.get('compressed_kb', 0) for r in results)
    
    draw.text((50, y + 15), 'Summary', fill='#1976d2')
    draw.text((50, y + 40), f'Total Files: {len(results)}  |  Total Size: {total_size:.1f} KB  |  Total Compressed: {total_compressed:.1f} KB', fill='#333')
    
    img.save(output_path, 'PNG')
    return output_path

# Main
print("Analyzing Excalidraw files...")
print()

excalidraw_dir = Path("Excalidraw")
output_dir = Path("Excalidraw/exports")
output_dir.mkdir(exist_ok=True)

files = sorted(excalidraw_dir.glob("*.excalidraw.md"))
results = []

for file_path in files:
    result = analyze_excalidraw(file_path)
    results.append(result)
    print(f"  {result['file']}: {result['type']} ({result['compressed_kb']} KB compressed)")

print()
print("Creating visual report...")

output_path = output_dir / "excalidraw_analysis_report.png"
create_visual_report(results, str(output_path))

print(f"Report saved to: {output_path}")
print()
print("Next steps to export actual drawings as images:")
print("1. Open Obsidian")
print("2. Open any .excalidraw.md file")
print("3. Use Excalidraw plugin menu -> Export image")
print("4. Save as PNG")
print("5. I can then analyze the exported images")
