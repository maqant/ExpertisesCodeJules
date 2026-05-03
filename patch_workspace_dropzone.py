import re

with open('src/components/Workspace.jsx', 'r') as f:
    content = f.read()

# Remove DropZone component
dropzone_def = re.compile(r'const DropZone = \(\{ onFiles, label = "\+", accept = "\*", className = "" \}\) => \{.*?    \);\n};\n\n', re.DOTALL)
content = re.sub(dropzone_def, '', content)

with open('src/components/Workspace.jsx', 'w') as f:
    f.write(content)
