from PIL import Image, ImageDraw
import os

# 源文件夹和目标文件夹
input_folder = "imgs"
output_folder = "imgs_cropped"
os.makedirs(output_folder, exist_ok=True)

# 裁剪并生成圆形图像
for i in range(1, 12):
    img_path = os.path.join(input_folder, f"{i}.png")
    output_path = os.path.join(output_folder, f"{i}.png")

    with Image.open(img_path).convert("RGBA") as im:
        size = min(im.size)
        # 中心正方形裁剪
        left = (im.width - size) // 2
        top = (im.height - size) // 2
        cropped = im.crop((left, top, left + size, top + size)).resize((128, 128), Image.LANCZOS)

        # 生成圆形遮罩
        mask = Image.new("L", (128, 128), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, 128, 128), fill=255)

        # 应用遮罩为圆形图
        result = Image.new("RGBA", (128, 128))
        result.paste(cropped, (0, 0), mask=mask)
        result.save(output_path)

print("圆形图像已保存到 imgs_cropped 文件夹。")
