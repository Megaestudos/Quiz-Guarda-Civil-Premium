import os
import re

CSS_CONTENT = """
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-dark: #0f172a;
            --bg-darker: #020617;
            --accent-primary: #38bdf8;
            --accent-secondary: #818cf8;
            --accent-tertiary: #c084fc;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --glass-bg: rgba(30, 41, 59, 0.4);
            --glass-border: rgba(255, 255, 255, 0.08);
            --glass-highlight: rgba(255, 255, 255, 0.12);
        }

        body {
            font-family: 'Inter', sans-serif;
            background: radial-gradient(circle at top right, #1e1b4b 0%, var(--bg-darker) 40%, var(--bg-darker) 100%);
            color: var(--text-main);
            min-height: 100vh;
            overflow-x: hidden;
            position: relative;
        }

        h1, h2, h3, h4, h5, h6 {
            font-family: 'Poppins', sans-serif;
            font-weight: 700;
        }

        /* Animated background elements */
        .bg-animation {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            pointer-events: none;
            overflow: hidden;
        }

        .blob {
            position: absolute;
            border-radius: 50%;
            mix-blend-mode: screen;
            filter: blur(80px);
            opacity: 0.4;
            animation: float 10s ease-in-out infinite alternate;
        }

        .blob-1 {
            width: 500px;
            height: 500px;
            background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
            top: -100px;
            right: -100px;
            animation-delay: 0s;
        }

        .blob-2 {
            width: 450px;
            height: 450px;
            background: linear-gradient(135deg, var(--accent-secondary), var(--accent-tertiary));
            bottom: -50px;
            left: -100px;
            animation-delay: -5s;
        }

        @keyframes float {
            0% { transform: translateY(0px) scale(1) rotate(0deg); }
            100% { transform: translateY(30px) scale(1.1) rotate(10deg); }
        }

        .container {
            position: relative;
            z-index: 1;
            max-width: 1200px;
            margin: 0 auto;
            padding: 50px 20px;
        }

        /* Header */
        header {
            display: flex;
            align-items: center;
            gap: 35px;
            margin-bottom: 60px;
            animation: slideInDown 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .logo-box {
            width: 110px;
            height: 110px;
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 28px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--glass-border);
            box-shadow: 0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 var(--glass-highlight);
            flex-shrink: 0;
            position: relative;
            overflow: hidden;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .logo-box::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(from 0deg, transparent 0%, var(--glass-highlight) 25%, transparent 50%);
            animation: spin 4s linear infinite;
        }

        .logo-box::after {
            content: '';
            position: absolute;
            inset: 2px;
            background: var(--bg-dark);
            border-radius: 26px;
            z-index: 0;
        }

        @keyframes spin {
            100% { transform: rotate(360deg); }
        }

        .logo-box:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 30px 60px rgba(56, 189, 248, 0.2), inset 0 1px 0 var(--glass-highlight);
        }

        .logo-text {
            font-size: 36px;
            font-weight: 900;
            background: linear-gradient(135deg, #fff 0%, var(--accent-primary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            z-index: 1;
            letter-spacing: -1px;
        }

        .logo-sub {
            font-size: 10px;
            font-weight: 800;
            color: var(--accent-primary);
            margin-top: 2px;
            z-index: 1;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .header-content h1 {
            font-size: 52px;
            font-weight: 900;
            margin-bottom: 15px;
            line-height: 1.1;
            letter-spacing: -1.5px;
        }

        .header-content h1 span {
            background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-tertiary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            display: inline-block;
        }

        .header-content p {
            font-size: 18px;
            color: var(--text-muted);
            line-height: 1.6;
            max-width: 650px;
            font-weight: 400;
        }

        .back-button {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            padding: 12px 24px;
            border-radius: 14px;
            color: var(--accent-primary);
            text-decoration: none;
            font-weight: 600;
            font-size: 15px;
            transition: all 0.3s ease;
            margin-bottom: 40px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        .back-button:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: var(--accent-primary);
            transform: translateX(-5px);
            box-shadow: 0 8px 25px rgba(56, 189, 248, 0.2);
        }

        /* Grid de Cards */
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 60px;
        }

        .card {
            background: var(--glass-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-radius: 24px;
            padding: 35px;
            border: 1px solid var(--glass-border);
            text-decoration: none;
            color: inherit;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            gap: 20px;
            cursor: pointer;
            position: relative;
            overflow: hidden;
            animation: fadeInUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            opacity: 0;
            box-shadow: 0 15px 35px rgba(0,0,0,0.2), inset 0 1px 0 var(--glass-highlight);
        }

        .card:nth-child(1) { animation-delay: 0.1s; }
        .card:nth-child(2) { animation-delay: 0.15s; }
        .card:nth-child(3) { animation-delay: 0.2s; }
        .card:nth-child(4) { animation-delay: 0.25s; }
        .card:nth-child(5) { animation-delay: 0.3s; }
        .card:nth-child(6) { animation-delay: 0.35s; }
        .card:nth-child(7) { animation-delay: 0.4s; }
        .card:nth-child(8) { animation-delay: 0.45s; }
        .card:nth-child(9) { animation-delay: 0.5s; }
        .card:nth-child(10) { animation-delay: 0.55s; }
        .card:nth-child(11) { animation-delay: 0.6s; }
        .card:nth-child(12) { animation-delay: 0.65s; }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
            transition: left 0.7s ease;
        }

        .card:hover::before { left: 100%; }

        .card:hover {
            transform: translateY(-10px) scale(1.02);
            background: rgba(30, 41, 59, 0.6);
            border-color: rgba(255, 255, 255, 0.15);
            box-shadow: 0 30px 60px rgba(0,0,0,0.4), 0 0 20px rgba(56, 189, 248, 0.1), inset 0 1px 0 rgba(255,255,255,0.2);
        }

        .icon-box {
            width: 65px;
            height: 65px;
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255,255,255,0.2);
            color: #fff;
            position: relative;
            z-index: 2;
        }

        .card:nth-child(1) .icon-box, .card:nth-child(5) .icon-box, .card:nth-child(9) .icon-box { background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); }
        .card:nth-child(2) .icon-box, .card:nth-child(6) .icon-box, .card:nth-child(10) .icon-box { background: linear-gradient(135deg, #818cf8 0%, #4f46e5 100%); }
        .card:nth-child(3) .icon-box, .card:nth-child(7) .icon-box, .card:nth-child(11) .icon-box { background: linear-gradient(135deg, #c084fc 0%, #9333ea 100%); }
        .card:nth-child(4) .icon-box, .card:nth-child(8) .icon-box, .card:nth-child(12) .icon-box { background: linear-gradient(135deg, #f472b6 0%, #db2777 100%); }
        
        /* Fallback elements for content pages */
        .content-section .icon-box { background: linear-gradient(135deg, var(--accent-primary) 0%, #0284c7 100%); }

        .card:hover .icon-box {
            transform: scale(1.15) rotate(5deg);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255,255,255,0.3);
        }

        .card h3 {
            font-size: 22px;
            color: var(--text-main);
            transition: color 0.3s ease;
            letter-spacing: -0.5px;
            line-height: 1.3;
        }

        .card:hover h3 { color: var(--accent-primary); }

        .card p {
            font-size: 15px;
            color: var(--text-muted);
            line-height: 1.6;
            flex-grow: 1;
        }

        .card-footer {
            display: flex;
            align-items: center;
            gap: 12px;
            color: var(--accent-primary);
            font-weight: 600;
            font-size: 14px;
            transition: all 0.3s ease;
            margin-top: auto;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .card:hover .card-footer { gap: 18px; color: var(--accent-secondary); }

        .card-footer i { transition: transform 0.3s ease; }
        .card:hover .card-footer i { transform: translateX(5px); }

        /* Seções de Conteúdo (Subpáginas) */
        .content-section {
            background: var(--glass-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-radius: 24px;
            padding: 45px;
            border: 1px solid var(--glass-border);
            margin-bottom: 40px;
            animation: fadeInUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            opacity: 0;
            box-shadow: 0 15px 35px rgba(0,0,0,0.2), inset 0 1px 0 var(--glass-highlight);
        }

        .content-section:nth-child(2) { animation-delay: 0.1s; }
        .content-section:nth-child(3) { animation-delay: 0.2s; }
        .content-section:nth-child(4) { animation-delay: 0.3s; }
        .content-section:nth-child(5) { animation-delay: 0.4s; }
        .content-section:nth-child(6) { animation-delay: 0.5s; }
        .content-section:nth-child(7) { animation-delay: 0.6s; }

        .content-section h2 {
            font-size: 32px;
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            gap: 15px;
            color: var(--text-main);
            letter-spacing: -0.5px;
        }

        .content-section h2 i {
            background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-tertiary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 32px;
        }

        .content-section h3 {
            font-size: 24px;
            margin-top: 35px;
            margin-bottom: 15px;
            color: var(--accent-secondary);
            letter-spacing: -0.5px;
        }

        .content-section p {
            font-size: 16px;
            color: var(--text-muted);
            line-height: 1.8;
            margin-bottom: 20px;
        }

        /* Cards de Informação */
        .info-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 25px;
            margin: 35px 0;
        }

        .info-card {
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid var(--glass-border);
            border-radius: 18px;
            padding: 25px;
            transition: all 0.3s ease;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .info-card:hover {
            background: rgba(30, 41, 59, 0.8);
            border-color: rgba(255, 255, 255, 0.15);
            transform: translateY(-5px);
            box-shadow: 0 15px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
        }

        .info-card h4 {
            font-size: 17px;
            margin-bottom: 12px;
            color: var(--accent-primary);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .info-card h4 i { color: var(--accent-tertiary); }

        .info-card p {
            font-size: 15px;
            margin: 0;
            color: var(--text-muted);
        }

        /* Gráficos */
        .chart-container {
            position: relative;
            height: 400px;
            margin: 40px 0;
            background: rgba(15, 23, 42, 0.4);
            border-radius: 20px;
            padding: 25px;
            border: 1px solid var(--glass-border);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }

        /* Listas */
        .content-list {
            list-style: none;
            margin: 25px 0;
        }

        .content-list li {
            padding: 14px 0 14px 35px;
            position: relative;
            font-size: 16px;
            color: var(--text-muted);
            line-height: 1.6;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .content-list li:last-child { border-bottom: none; }

        .content-list li:before {
            content: "\\f00c";
            font-family: "Font Awesome 6 Free";
            font-weight: 900;
            position: absolute;
            left: 0;
            top: 15px;
            color: var(--accent-primary);
            font-size: 16px;
            background: rgba(56, 189, 248, 0.1);
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Tabelas */
        .table-container {
            overflow-x: auto;
            margin: 35px 0;
            border-radius: 16px;
            border: 1px solid var(--glass-border);
            background: rgba(15, 23, 42, 0.4);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 15px;
        }

        table th {
            background: rgba(255, 255, 255, 0.03);
            padding: 18px 20px;
            text-align: left;
            font-weight: 700;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--text-main);
            letter-spacing: 0.5px;
        }

        table td {
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            color: var(--text-muted);
            transition: all 0.3s ease;
        }

        table tr:last-child td { border-bottom: none; }

        table tr:hover td {
            background: rgba(255, 255, 255, 0.02);
            color: var(--text-main);
        }

        /* Destaque */
        .highlight-box {
            background: linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(129, 140, 248, 0.05));
            border-left: 4px solid var(--accent-primary);
            padding: 25px;
            border-radius: 0 16px 16px 0;
            margin: 30px 0;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .highlight-box p { margin-bottom: 0; color: var(--text-main); }
        .highlight-box strong { color: var(--accent-primary); }

        /* Footer */
        footer {
            text-align: center;
            padding: 40px 20px;
            border-top: 1px solid var(--glass-border);
            background: rgba(2, 6, 23, 0.8);
            backdrop-filter: blur(10px);
            animation: fadeIn 1s ease-out 0.8s forwards;
            opacity: 0;
            margin-top: 60px;
            position: relative;
            z-index: 1;
        }

        footer p {
            font-size: 15px;
            color: var(--text-muted);
            margin-bottom: 8px;
            font-weight: 500;
        }

        footer .sub {
            font-size: 13px;
            color: rgba(148, 163, 184, 0.6);
            letter-spacing: 0.5px;
        }

        /* Animations */
        @keyframes slideInDown {
            from { opacity: 0; transform: translateY(-40px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        /* Responsive */
        @media (max-width: 900px) {
            .header-content h1 { font-size: 42px; }
            .grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
            .content-section { padding: 35px 25px; }
        }

        @media (max-width: 768px) {
            header { flex-direction: column; align-items: flex-start; gap: 25px; margin-bottom: 40px; }
            .logo-box { width: 90px; height: 90px; border-radius: 22px; }
            .logo-text { font-size: 28px; }
            .header-content h1 { font-size: 36px; letter-spacing: -1px; }
            .header-content p { font-size: 16px; }
            .grid { gap: 20px; }
            .card { padding: 25px; border-radius: 20px; gap: 15px; }
            .icon-box { width: 55px; height: 55px; font-size: 24px; border-radius: 14px; }
            .card h3 { font-size: 20px; }
            .card p { font-size: 14px; }
            .container { padding: 30px 15px; }
            .content-section h2 { font-size: 26px; }
            .content-section h3 { font-size: 20px; }
            .chart-container { height: 300px; }
            .info-cards { grid-template-columns: 1fr; }
        }

        @media (max-width: 480px) {
            .header-content h1 { font-size: 30px; }
            .header-content p { font-size: 15px; }
            .content-section { padding: 25px 20px; border-radius: 20px; }
            .content-section h2 { font-size: 22px; flex-direction: column; align-items: flex-start; gap: 10px; }
            .content-section h3 { font-size: 18px; }
            .chart-container { height: 250px; }
            table th, table td { padding: 12px 15px; font-size: 14px; }
        }
"""

def update_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Regex to find <style>...</style> block
        pattern = re.compile(r'<style>.*?</style>', re.DOTALL | re.IGNORECASE)
        
        # Format the replacement block
        replacement = f'<style>\n{CSS_CONTENT}\n    </style>'
        
        new_content, num_subs = pattern.subn(replacement, content)
        
        if num_subs > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filepath} ({num_subs} substitutions)")
        else:
            print(f"No <style> tags found in {filepath}")
            
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

if __name__ == "__main__":
    directory = "."
    for filename in os.listdir(directory):
        if filename.endswith(".html"):
            update_file(os.path.join(directory, filename))

print("All HTML files processed.")
