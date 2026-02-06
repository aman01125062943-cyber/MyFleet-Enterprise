
file_path = r"c:\Users\amin\Desktop\copy-of-مدير-الأسطول---enterprise-saas\components\SuperAdminDashboard.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

total_backticks = 0

print(f"{'Line':<5} | {'Count':<5} | {'Total':<5} | {'Content'}")
print("-" * 60)

for i, line in enumerate(lines):
    count = line.count('`')
    if count > 0:
        total_backticks += count
        # Print only if count is non-zero to reduce noise, or if total is odd (inside string)
        # Actually let's print the first few transitions.
        # And specifically around 160-170
        
        should_print = False
        if i < 200: should_print = True # Focus on the start
        
        if should_print:
            print(f"{i+1:<5} | {count:<5} | {total_backticks:<5} | {line.strip()[:50]}")

print("-" * 60)
print(f"Final Total: {total_backticks}")
