import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS, getActions, UNIFIED_RULES } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        if (!baseConfig) {
            baseConfig = CLASH_CONFIG;
        }
        super(inputString, baseConfig, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
    }

    getProxies() {
        return this.config.proxies || [];
    }

    getProxyName(proxy) {
        return proxy.name;
    }

    convertProxy(proxy) {
        switch(proxy.type) {
            case 'shadowsocks':
                return {
                    name: proxy.tag,
                    type: 'ss',
                    server: proxy.server,
                    port: proxy.server_port,
                    cipher: proxy.method,
                    password: proxy.password
                };
            case 'vmess':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    alterId: proxy.alter_id,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled,
                    servername: proxy.tls?.server_name,
                    network: proxy.transport?.type,
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined
                };
            case 'vless':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled,
                    'client-fingerprint': proxy.tls.utls?.fingerprint,
                    servername: proxy.tls?.server_name,
                    network: proxy.transport?.type,
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    }: undefined,
                    'reality-opts': proxy.tls.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo : proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls.insecure,
                    'flow': proxy.flow ?? undefined,
                };
            case 'hysteria2':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    obfs: proxy.obfs.type,
                    'obfs-password': proxy.obfs.password,
                    password: proxy.password,
                    auth: proxy.password,
                    'skip-cert-verify': proxy.tls.insecure,
                };
            case 'trojan':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled,
                    'client-fingerprint': proxy.tls.utls?.fingerprint,
                    sni: proxy.tls?.server_name,
                    network: proxy.transport?.type,
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    }: undefined,
                    'reality-opts': proxy.tls.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo : proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls.insecure,
                    'flow': proxy.flow ?? undefined,
                };
            case 'tuic':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    'congestion-controller': proxy.congestion,
                    'skip-cert-verify': proxy.tls.insecure,
                    'disable-sni': true,
                    'alpn': proxy.tls.alpn,
                    'sni': proxy.tls.server_name,
                    'udp-relay-mode': 'native',
                };
            default:
                return proxy; // Return as-is if no specific conversion is defined
        }
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        this.config.proxies.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            name: t('outboundNames.Auto Select'),
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'http://www.v2ex.com/generate_204',
            interval: '600'
        });
    }

    addNodeSelectGroup(proxyList) {
        proxyList.unshift('DIRECT', t('outboundNames.Auto Select'));
        this.config['proxy-groups'].unshift({
            type: "select",
            name: t('outboundNames.Node Select'),
            proxies: proxyList
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select') && getActions(outbound) != 'DIRECT' && getActions(outbound) != 'REJECT') {
                this.config['proxy-groups'].push({
                    type: "select",
                    name: t(`outboundNames.${outbound}`),
                    proxies: [t('outboundNames.Node Select'), ...proxyList]
                });
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push({
                    type: "select",
                    name: t(`outboundNames.${rule.name}`),
                    proxies: [t('outboundNames.Node Select'), ...proxyList]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push({
            type: "select",
            name: t('outboundNames.Fall Back'),
            proxies: [t('outboundNames.Node Select'), ...proxyList]
        });
    }

    // 生成规则
    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        const rules = this.generateRules();
        
        // 获取.txt规则集配置
        const { site_rule_providers, non_ip_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        
        // 添加规则集提供者
        this.config['rule-providers'] = {
            ...site_rule_providers,
            ...non_ip_rule_providers,
            ...ip_rule_providers
        };

        // 使用RULE-SET规则格式替代原有的GEOSITE/GEOIP
        this.config.rules = rules.flatMap(rule => {
            const ruleResults = [];
            
            // 使用RULE-SET格式的站点规则
            if (rule.site_rules && rule.site_rules[0] !== '') {
                rule.site_rules.forEach(site => {
                    if (getActions(rule.outbound) == 'REJECT') {
                        ruleResults.push(`RULE-SET,${site}_domainset,REJECT`);
                    } else if (getActions(rule.outbound) == 'DIRECT') {
                        ruleResults.push(`RULE-SET,${site}_domainset,DIRECT`);
                    } else {
                        ruleResults.push(`RULE-SET,${site}_domainset,${t('outboundNames.'+ rule.outbound)}`);
                    }
                });
            }

            if (rule.non_ip_rules && rule.non_ip_rules[0] !== '') {
                rule.non_ip_rules.forEach(non_ip => {
                    if (getActions(rule.outbound) ==  'REJECT') {
                        ruleResults.push(`RULE-SET,${non_ip}_non_ip,REJECT`);
                    } else if (getActions(rule.outbound) == 'DIRECT') {
                        ruleResults.push(`RULE-SET,${non_ip}_non_ip,DIRECT`);
                    } else {
                        ruleResults.push(`RULE-SET,${non_ip}_non_ip,${t('outboundNames.'+ rule.outbound)}`);
                    }
                });
            }
            
            // 使用RULE-SET格式的IP规则
            if (rule.ip_rules && rule.ip_rules[0] !== '') {
                rule.ip_rules.forEach(ip => {
                    if (getActions(rule.outbound) == 'REJECT') {
                        ruleResults.push(`RULE-SET,${ip}_ip,REJECT`);
                    } else if (getActions(rule.outbound) == 'DIRECT') {
                        ruleResults.push(`RULE-SET,${ip}_ip,DIRECT`);
                    } else {
                        ruleResults.push(`RULE-SET,${ip}_ip,${t('outboundNames.'+ rule.outbound)}`);
                    }
                });
            }
            
            // 保持对其他类型规则的支持
            const domainSuffixRules = rule.domain_suffix ? rule.domain_suffix.map(suffix => 
                `DOMAIN-SUFFIX,${suffix},${t('outboundNames.'+ rule.outbound)}`) : [];
            const domainKeywordRules = rule.domain_keyword ? rule.domain_keyword.map(keyword => 
                `DOMAIN-KEYWORD,${keyword},${t('outboundNames.'+ rule.outbound)}`) : [];
            const ipCidrRules = rule.ip_cidr ? rule.ip_cidr.map(cidr => 
                `IP-CIDR,${cidr},${t('outboundNames.'+ rule.outbound)}`) : [];
            
            return [...ruleResults, ...domainSuffixRules, ...domainKeywordRules, ...ipCidrRules];
        });

        this.config.rules.push(`MATCH,${t('outboundNames.Fall Back')}`);

        return yaml.dump(this.config);
    }
}