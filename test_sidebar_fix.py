import re

with open('src/components/Sidebar.jsx', 'r') as f:
    content = f.read()

# We need to make sure we didn't add it multiple times or put it in the wrong place. Let's check:
matches = re.findall(r'const handleMagicDrop = async', content)
print(f"Count of handleMagicDrop declarations: {len(matches)}")
