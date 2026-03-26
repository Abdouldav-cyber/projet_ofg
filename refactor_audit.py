import os
import re

file_path = r'c:\Users\ASUS\Desktop\Projet_OFG\backend\core-service\app\routes_admin.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remettre au propre la création de table audit_logs
sql_old = """                CREATE TABLE IF NOT EXISTS {schema_name}.audit_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID,
                    tenant_id VARCHAR(10),
                    session_id VARCHAR(100),
                    action VARCHAR(100) NOT NULL,
                    resource VARCHAR(100),
                    resource_id VARCHAR(100),
                    before_value JSONB,
                    after_value JSONB,
                    details JSONB,
                    ip_address VARCHAR(45),
                    user_agent VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );"""
sql_new = """                CREATE TABLE IF NOT EXISTS {schema_name}.audit_logs (
                    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    user_id UUID,
                    user_email VARCHAR(255),
                    user_role VARCHAR(50),
                    ip_address INET,
                    user_agent TEXT,
                    action VARCHAR(100),
                    resource_type VARCHAR(50),
                    resource_id UUID,
                    changes JSONB,
                    metadata JSONB,
                    tenant_id UUID,
                    request_id UUID,
                    session_id UUID
                );"""
content = content.replace(sql_old, sql_new)

# 2. Remplacer la logique du trigger
trigger_old = """                BEGIN
                    INSERT INTO {schema_name}.audit_logs (action, resource, resource_id, before_value, after_value)
                    VALUES (
                        TG_OP || '.users',
                        'user',
                        NEW.id::text,
                        row_to_json(OLD)::jsonb,
                        row_to_json(NEW)::jsonb
                    );
                    RETURN NEW;
                END;"""
trigger_new = """                BEGIN
                    INSERT INTO {schema_name}.audit_logs (action, resource_type, resource_id, changes)
                    VALUES (
                        TG_OP || '.users',
                        'user',
                        NEW.id,
                        jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
                    );
                    RETURN NEW;
                END;"""
content = content.replace(trigger_old, trigger_new)

# 3. Remplacer les kwargs Python pour AuditLog
content = content.replace('resource=', 'resource_type=')
content = content.replace('details=', 'metadata_col=')
content = re.sub(r'resource_id\s*=\s*str\(([^)]+)\)', r'resource_id=\1', content)

# Sauvegarde
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Refactoring apply successfully!")
