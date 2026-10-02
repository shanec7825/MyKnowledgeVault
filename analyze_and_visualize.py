# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import base64

def analyze_excalidraw_structure(file_path):
    """Analyze Excalidraw file without decompression"""
    content = Path(file_path).read_text(encoding='utf-8')
    
    # Extract metadata
    result = {
        'file': Path(file_path).name,
        'size': len(content),
        'has_frontmatter': '---' in content[:100],
        'has_compressed_json': '```compressed-json' in content,
        'plugin_version': None
    }
    
    # Check for Excalidraw plugin version
    if 'excalidraw-plugin: parsed' in content:
        result['plugin'] = 'Excalidraw Plugin'
    
    # Extract compressed data size
    match = re.search(r'```compressed-json\s+(.+?)\s+```', content, re.DOTALL)
    if match:
        compressed_data = match.group(1).strip()
        result['compressed_size'] = len(compressed_data)
        
        # Estimate content complexity based on compressed size
        if len(compressed_data) < 300:
            result['complexity'] = '空画布'
            result['estimated_elements'] = 0
        elif len(compressed_data) < 5000:
            result['complexity'] = '简单'
            result['estimated_elements'] = '5-20'
        elif len(compressed_data) < 20000:
            result['complexity'] = '中等'
            result['estimated_elements'] = '20-100'
        elif len(compressed_data) < 100000:
            result['complexity'] = '复杂'
            result['estimated_elements'] = '100-500'
        else:
            result['complexity'] = '非常复杂'
            result['estimated_elements'] = '500+'
    
    return result

def create_analysis_image(results, output_path):
    """Create a visual analysis report as an image"""
    # Image dimensions
    width = 1200
    height_per_file = 100
    total_height = 150 + len(results) * height_per_file + 100
    
    # Create image
    img = Image.new('RGB', (width, total_height), color='#f5f5f5')
    draw = ImageDraw.Draw(img)
    
    # Try to use a font
    try:
        title_font = ImageFont.truetype("arial.ttf", 24)
        header_font = ImageFont.truetype("arial.ttf", 18)
        text_font = ImageFont.truetype("arial.ttf", 14)
    except:
        title_font = ImageFont.load_default()
        header_font = ImageFont.load_default()
        text_font = ImageFont.load_default()
    
    # Draw title
    draw.rectangle([0, 0, width, 100], fill='#667eea')
    draw.text((40, 30), 'Excalidraw 文件分析报告', fill='white', font=title_font)
    
    # Draw file cards
    y_offset = 130
    
    for i, result in enumerate(results):
        # Card background
        card_color = '#ffffff' if i % 2 == 0 else '#f9f9f9'
        draw.rectangle([30, y_offset, width - 30, y_offset + height_per_file - 10], 
                      fill=card_color, outline='#e0e0e0')
        
        # File name
        draw.text((50, y_offset + 15), result['file'][:50], fill='#333', font=header_font)
        
        # Stats
        stats_text = f"大小: {result['size']:,} bytes | 压缩数据: {result.get('compressed_size', 0):,} chars"
        draw.text((50, y_offset + 45), stats_text, fill='#666', font=text_font)
        
        # Complexity badge
        complexity = result.get('complexity', '未知')
        badge_colors = {
            '空画布': '#9e9e9e',
            '简单': '#4caf50',
            '中等': '#2196f3',
            '复杂': '#ff9800',
            '非常复杂': '#f44336'
        }
        badge_color = badge_colors.get(complexity, '#9e9e9e')
        
        # Draw badge
        badge_x = width - 200
        badge_y = y_offset + 25
        draw.rectangle([badge_x, badge_y, badge_x + 150, badge_y + 30], fill=badge_color)
        draw.text((badge_x + 15, badge_y + 8), complexity, fill='white', font=text_font)
        
        # Estimated elements
        est_text = f"预估元素: {result.get('estimated_elements', 'N/A')}"
        draw.text((badge_x, y_offset + 60), est_text, fill='#666', font=text_font)
        
        y_offset += height_per_file
    
    # Summary section
    draw.rectangle([30, y_offset + 20, width - 30, y_offset + 120], fill='#e3f2fd', outline='#2196f3')
    draw.text((50, y_offset + 40), '📊 总结', fill='#1976d2', font=header_font)
    
    total_files = len(results)
    total_size = sum(r['size'] for r in results)
    total_elements = sum(r.get('compressed_size', 0) for r in results)
    
    summary = f"共 {total_files} 个文件 | 总大小: {total_size:,} bytes | 总压缩数据: {total_elements:,} chars"
    draw.text((50, y_offset + 75), summary, fill='#333', font=text_font)
    
    # Save image
    img.save(output_path, 'PNG')
    print(f"分析报告已保存: {output_path}")

# Process all Excalidraw files
excalidraw_dir = Path("Excalidraw")
files = sorted(excalidraw_dir.glob("*.excalidraw.md"))

print("正在分析 Excalidraw 文件...")
print()

results = []
for file_path in files:
    result = analyze_excalidraw_structure(file_path)
    results.append(result)
    
    print(f"✓ {result['file']}")
    print(f"  大小: {result['size']:,} bytes")
    print(f"  复杂度: {result.get('complexity', 'N/A')}")
    print(f"  预估元素: {result.get('estimated_elements', 'N/A')}")
    print()

# Create visual report
output_image = "Excalidraw/exports/excalidraw_analysis.png"
Path("Excalidraw/exports").mkdir(exist_ok=True)

create_analysis_image(results, output_image)

print("=" * 60)
print("分析完成！")
print(f"生成的分析报告图片: {output_image}")
print()
print("下一步:")
print("1. 查看生成的分析报告图片")
print("2. 在 Obsidian 中手动导出具体绘图为 PNG")
print("3. 我可以分析导出的图片")
