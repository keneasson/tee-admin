# TEE Admin Wishlist

## 🗄️ Multi-Environment Database Strategy

### Current State
- Single production tables: `tee-admin`, `tee-schedules`, `tee-sync-status`
- All development and testing happens on production data
- No isolated environment for experiments

### Proposed Solution: Environment-Based Table Naming

**Table Naming Convention:**
```
{environment}-{service}-{table}
```

**Examples:**
- **Production**: `prod-tee-admin`, `prod-tee-schedules`, `prod-tee-sync-status`
- **Development**: `dev-tee-admin`, `dev-tee-schedules`, `dev-tee-sync-status`
- **Staging**: `staging-tee-admin`, `staging-tee-schedules`, `staging-tee-sync-status`
- **Feature Branches**: `feature-{branch}-tee-admin` (for major features)

### Benefits

**1. Safe Experimentation**
- Test schema changes without affecting production
- Experiment with new features safely
- Performance testing with realistic data volumes

**2. Gradual Rollouts**
- Test migration scripts on dev/staging first
- Validate new features before production deployment
- A/B testing capabilities

**3. Data Protection**
- No risk of corrupting production member data
- Safe testing of webhook integration
- Rollback capabilities

### Implementation Strategy

**Phase 1: Environment Configuration**
```typescript
// config/environments.ts
export const environments = {
  development: { tablePrefix: 'dev' },
  staging: { tablePrefix: 'staging' },
  production: { tablePrefix: 'prod' },
  test: { tablePrefix: 'test' }
}

// Automatically determined from NODE_ENV or STAGE env var
export const currentEnv = process.env.STAGE || process.env.NODE_ENV || 'development'
```

**Phase 2: Migration Strategy**
```bash
# 1. Create new prod tables with current data
yarn migrate-to-environments:prod

# 2. Create dev/staging tables (empty or with test data)
yarn create-environment:dev
yarn create-environment:staging

# 3. Update application to use environment-aware table names
yarn deploy:environment-aware

# 4. Clean up old single tables (after validation)
yarn cleanup-legacy-tables
```

**Phase 3: Development Workflow**
```bash
# Daily development
STAGE=dev yarn web                    # Use dev tables
STAGE=staging yarn deploy:staging     # Test on staging
STAGE=prod yarn deploy:production     # Deploy to production

# Feature development
STAGE=feature-new-auth yarn web       # Isolated feature tables
```

### Configuration Updates Needed

**1. DynamoDB Config Enhancement**
```typescript
// packages/app/provider/dynamodb/config.ts
export const tableNames = {
  admin: `${getEnvironmentPrefix()}-tee-admin`,
  schedules: `${getEnvironmentPrefix()}-tee-schedules`, 
  syncStatus: `${getEnvironmentPrefix()}-tee-sync-status`,
}

function getEnvironmentPrefix(): string {
  const stage = process.env.STAGE || process.env.NODE_ENV || 'dev'
  
  // Map common environments
  const envMap = {
    'development': 'dev',
    'production': 'prod',
    'staging': 'staging',
    'test': 'test'
  }
  
  return envMap[stage] || stage
}
```

**2. Environment-Specific Scripts**
```json
// package.json
{
  "scripts": {
    "web:dev": "STAGE=dev yarn web",
    "web:staging": "STAGE=staging yarn web", 
    "web:prod": "STAGE=prod yarn web",
    "setup-tables:dev": "STAGE=dev yarn setup-dynamodb",
    "setup-tables:staging": "STAGE=staging yarn setup-dynamodb",
    "setup-tables:prod": "STAGE=prod yarn setup-dynamodb"
  }
}
```

**3. Data Migration Tools**
```bash
# Copy production data to staging for testing
yarn copy-data --from=prod --to=staging

# Sync dev with a subset of prod data (anonymized)
yarn sync-dev-data --anonymize

# Backup before major changes
yarn backup-environment --env=prod
```

### Security Considerations

**1. Access Control**
- Separate IAM roles for each environment
- Developers can access dev/staging, limited prod access
- Automated systems use environment-specific credentials

**2. Data Privacy**
- Development environments use anonymized/synthetic data
- Production data requires special permissions to access
- Audit logging for all production table access

**3. Cost Management**
- Smaller instance sizes for dev/staging
- Automatic cleanup of old feature branch tables
- Monitoring and alerts for unexpected usage

### Rollback Strategy

**1. Blue/Green Deployments**
```bash
# Create new tables with updated schema
yarn create-environment:prod-v2

# Migrate data with validation
yarn migrate-data --from=prod --to=prod-v2 --validate

# Switch traffic to new tables
yarn switch-environment --from=prod --to=prod-v2

# Keep old tables for quick rollback
yarn archive-environment:prod-v1
```

**2. Schema Evolution**
- Non-breaking changes: Add columns, new GSI indices
- Breaking changes: Create new environment, migrate, switch
- Rollback plan: Keep previous schema version for 48 hours

### Monitoring & Alerting

**1. Environment Health Checks**
- Table availability across all environments
- Data consistency between environments
- Performance metrics per environment

**2. Cost Monitoring**
- Track costs per environment
- Alert on unexpected usage spikes
- Automated cleanup of abandoned feature branches

### Future Enhancements

**1. Environment Promotion Pipeline**
```bash
# Automated promotion flow
dev → staging → production
```

**2. Feature Flag Integration**
- Use environment-specific feature flags
- Gradual rollout across environments
- A/B testing within environments

**3. Automated Testing**
- Integration tests run against staging
- Performance tests on production-like data
- Schema compatibility tests

### Timeline Estimate
- **Phase 1**: Environment configuration (1 day)
- **Phase 2**: Migration strategy implementation (2-3 days)  
- **Phase 3**: Development workflow setup (1 day)
- **Testing & Validation**: (1-2 days)

**Total**: ~1 week for full multi-environment setup

---

## 📝 Other Wishlist Items

*Future wishlist items will be added here as they come up...*