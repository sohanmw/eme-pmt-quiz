import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

def create_app_icon():
    size = 1024
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. macOS Squircle Card Background with Rounded Corners
    padding = 64
    r = 210
    box = [padding, padding, size - padding, size - padding]

    # Draw gradient background manually into a temporary layer
    gradient = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(gradient)

    # Vertical gradient from indigo to violet
    c1 = (30, 27, 75)   # #1E1B4B
    c2 = (79, 70, 229)  # #4F46E5
    c3 = (14, 165, 233) # #0EA5E9
    for y in range(box[1], box[3]):
        ratio = (y - box[1]) / (box[3] - box[1])
        if ratio < 0.5:
            sub_r = ratio * 2
            r_val = int(c1[0] + (c2[0] - c1[0]) * sub_r)
            g_val = int(c1[1] + (c2[1] - c1[1]) * sub_r)
            b_val = int(c1[2] + (c2[2] - c1[2]) * sub_r)
        else:
            sub_r = (ratio - 0.5) * 2
            r_val = int(c2[0] + (c3[0] - c2[0]) * sub_r)
            g_val = int(c2[1] + (c3[1] - c2[1]) * sub_r)
            b_val = int(c2[2] + (c3[2] - c2[2]) * sub_r)
        g_draw.line([(box[0], y), (box[2], y)], fill=(r_val, g_val, b_val, 255))

    # Mask with rounded rectangle
    mask = Image.new('L', (size, size), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle(box, radius=r, fill=255)

    # Composite gradient onto background
    img.paste(gradient, (0, 0), mask)

    # Inner subtle border glow
    draw.rounded_rectangle(box, radius=r, outline=(255, 255, 255, 60), width=6)

    # 2. Draw 4 Kahoot Shapes (Triangle, Diamond, Circle, Square)
    # Center is at (512, 512)
    cx, cy = 512, 512
    s_offset = 150
    s_rad = 75

    # Top-Left: Red Triangle
    tx, ty = cx - s_offset, cy - s_offset
    draw.polygon([(tx, ty - s_rad), (tx + s_rad, ty + s_rad), (tx - s_rad, ty + s_rad)], fill=(244, 63, 94, 255))

    # Top-Right: Blue Diamond
    dx, dy = cx + s_offset, cy - s_offset
    draw.polygon([(dx, dy - s_rad), (dx + s_rad, dy), (dx, dy + s_rad), (dx - s_rad, dy)], fill=(14, 165, 233, 255))

    # Bottom-Left: Yellow Circle
    kx, ky = cx - s_offset, cy + s_offset
    draw.ellipse([kx - s_rad, ky - s_rad, kx + s_rad, ky + s_rad], fill=(245, 158, 11, 255))

    # Bottom-Right: Green Square
    gx, gy = cx + s_offset, cy + s_offset
    draw.rounded_rectangle([gx - s_rad, gy - s_rad, gx + s_rad, gy + s_rad], radius=20, fill=(16, 185, 129, 255))

    # Center: Glowing Lightning Bolt
    bolt = [
        (cx + 10, cy - 80),
        (cx - 55, cy + 10),
        (cx - 5, cy + 10),
        (cx - 15, cy + 80),
        (cx + 55, cy - 10),
        (cx + 5, cy - 10),
    ]
    draw.polygon(bolt, fill=(255, 255, 255, 255))

    # 3. Create iconset directory and sizes
    iconset_dir = "/Users/sohan/anti/quizhost/scratch/AppIcon.iconset"
    os.makedirs(iconset_dir, exist_ok=True)

    sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]

    for s, name in sizes:
        resized = img.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset_dir, name))

    icns_output = "/Users/sohan/anti/quizhost/scratch/AppIcon.icns"
    subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", icns_output], check=True)
    print("✓ Successfully generated AppIcon.icns")

if __name__ == '__main__':
    create_app_icon()
