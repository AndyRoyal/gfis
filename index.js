var fis = module.exports = require('fis3');
var path = require('path');
var _ = fis.util;

fis.require.prefixes.unshift('gfis');
fis.cli.name = 'gfis';
fis.cli.info = require('./package.json');

// 添加自定义命令
fis.require._cache['command-init'] = require('./command/init.js');
fis.set('modules.commands', ['init']);

var gfis = {
    /**
     * 初始化
     */
    init: function() {
        this.config = this._getConfig();
        this.setEvnCommonConfig();
        this.setEnvPrivateConfig();
    },
    /**
     * 设置环境通用配置
     */
    setEvnCommonConfig: function() {
        this._setBaseCommon();
        this._preCompile();
        this._processFileByMd5();
        this._processFileByCompress();
        this._processCssSprite();
        this._processFileByReleasePattern();
    },
    /**
     * 设置环境私有配置
     */
    setEnvPrivateConfig: function() {
        this._setDevEvnConfig();
        this._setUatEvnConfig();
        this._setPreEvnConfig();
        this._setPrdEvnConfig();
    },
    /**
     * 设置基础配置
     */
    _setBaseCommon: function() {
        //关闭编译缓存
        fis.match('*', {
            useCache: false
        });

        //不发布build文件
        fis.match('/build/**', {
            release: false
        });
    },
    /**
     * 异构语言预编译处理
     */
    _preCompile: function() {
        if (this.config.release.sass) {
            //sass的规范,_打头的文件都不release.
            fis.match('/sass/{**/_*.scss,_*.scss}', {
                release: false
            });

            //发布到css目录下，并且后缀设置为.css
            fis.match('/sass/**.{scss,css}', {
                parser: fis.plugin('node-sass'),
                rExt: '.css',
                release: '/css$0'
            });

            //预编译内嵌的sass
            fis.match('/html/**.{html,ftl}:scss', {
                parser: fis.plugin('node-sass')
            });
        }
    },
    /**
     * 处理文件MD5
     */
    _processFileByMd5: function() {
        if (this.config.release.cssMd5) {
            //css md5
            fis.match('/css/**.css', {
                useHash: true
            });

            //sass md5
            if (this.config.release.sass) {
                fis.match('/sass/**.{scss,css}', {
                    useHash: true
                });
            }
        }

        //js md5
        if (this.config.release.jsMd5) {
            fis.match('/js/**.js', {
                useHash: true
            });
        }

        //image md5
        if (this.config.release.imageMd5) {
            fis.match('::image', {
                useHash: true
            });
        }
    },
    /**
     * 处理文件压缩
     */
    _processFileByCompress: function() {
        //js压缩
        if (this.config.release.jsCompress) {
            fis.match('/js/**.js', {
                optimizer: fis.plugin('uglify-js')
            });

            //处理内嵌的js代码
            fis.match('/html/**.{html,ftl}:js', {
                optimizer: fis.plugin('uglify-js')
            });
        }

        //css压缩
        if (this.config.release.cssCompress) {
            fis.match('/css/**.css', {
                optimizer: fis.plugin('clean-css')
            });

            //处理内嵌的css代码
            fis.match('/html/**.{html,ftl}:css', {
                optimizer: fis.plugin('clean-css')
            });

            //sass压缩
            if (this.config.release.sass) {
                fis.match('/sass/**.{scss,css}', {
                    optimizer: fis.plugin('clean-css')
                });

                //处理内嵌的sass代码
                fis.match('/html/**.{html,ftl}:scss', {
                    optimizer: fis.plugin('clean-css')
                });
            }
        }

        //png图片压缩
        if (this.config.release.pngCompress) {
            fis.match('**.png', {
                optimizer: fis.plugin('png-compressor')
            });
        }

        //html压缩
        if (this.config.release.htmlCompress) {
            fis.match('/html/**.{html,ftl}', {
                optimizer: fis.plugin('html-minifier')
            });
        }
    },
    /**
     * 处理雪碧图
     */
    _processCssSprite: function() {
        if (this.config.release.cssSprite) {
            fis.match('::packager', {
                spriter: fis.plugin('csssprites')
            });

            //css雪碧图
            fis.match('/css/**.css', {
                useSprite: true
            });

            //sass雪碧图
            if (this.config.release.sass) {
                fis.match('/sass/**.{scss,css}', {
                    useSprite: true
                });
            }
        }
    },
    /**
     * 处理文件的发布规则
     */
    _processFileByReleasePattern: function() {
        var ignoreReleaseFiles = this.config.release.ignoreReleaseFiles;
        if (ignoreReleaseFiles !== null) {
            ignoreReleaseFiles.forEach(function(glob) {
                fis.match(glob, {
                    release: false
                });
            });
        }
    },
    /**
     * 设置开发环境配置
     */
    _setDevEvnConfig: function() {
        //为了方便server预览，开发环境将.ftl改为.html
        fis.match('/html/**.ftl', {
            rExt: '.html'
        });

        //设置freemarker解析和ssi
        fis.match('/html/**.{ftl,html}', {
                parser: [
                    fis.plugin('gfe-freemarker'),
                    fis.plugin('gfe-ssi', {
                        ssiDomain: 'http://www.gome.com.cn'
                    })
                ]
            })
            .match('*', {
                deploy: [
                    fis.plugin('gfe-script-inbottom'),
                    fis.plugin('gfe-script-place'),
                    fis.plugin('gfe-replace', {
                        patterns: [{
                            match: '__JS_DOMAIN__',
                            replacement: this.config.release.uatDomain.js
                        }, {
                            match: '__CSS_DOMAIN__',
                            replacement: this.config.release.uatDomain.css
                        }]
                    }),
                    fis.plugin('local-deliver', {
                        to: './build'
                    })
                ]
            });
    },
    /**
     * 设置uat环境配置
     */
    _setUatEvnConfig: function() {
        //是否开启debug输出
        if (this.config.release.debug) {
            fis
                .media('uat')
                .match('::package', {
                    //输出debug文件
                    prepackager: fis.plugin('gfe-debug-output', {
                        cssDomain: this.config.release.uatDomain.css,
                        jsDomain: this.config.release.uatDomain.js
                    })
                });
        }

        fis
            .media('uat')
            .match('**.js', { //js添加域名和项目前缀
                url: '/' + this.config.projectPath,
                domain: this.config.release.uatDomain.js
            })
            .match('**.{css,scss}', { //css添加域名和项目前缀
                url: '/' + this.config.projectPath,
                domain: this.config.release.uatDomain.css
            })
            .match('::image', { //图片添加项目前缀
                url: '/' + this.config.projectPath
            })
            .match('/html/**.{html,ftl}', {
                parser: null
            })
            .match('/html/**.ftl', {
                rExt: '.ftl'
            })
            .match('*', {
                deploy: [
                    fis.plugin('gfe-combo-url', {
                        useCombo: this.config.release.urlCombo
                    }),
                    fis.plugin('gfe-script-inbottom'),
                    fis.plugin('gfe-script-place'),
                    fis.plugin('gfe-replace', {
                        patterns: [{
                            match: '__JS_DOMAIN__',
                            replacement: this.config.release.uatDomain.js
                        }, {
                            match: '__CSS_DOMAIN__',
                            replacement: this.config.release.uatDomain.css
                        }]
                    }),
                    fis.plugin('local-deliver', {
                        to: './build'
                    })
                ]
            });
    },
    /**
     * 设置pre环境配置
     */
    _setPreEvnConfig: function() {
        //是否开启debug输出
        if (this.config.release.debug) {
            fis
                .media('pre')
                .match('::package', {
                    //输出debug文件
                    prepackager: fis.plugin('gfe-debug-output', {
                        cssDomain: this.config.release.preDomain.css,
                        jsDomain: this.config.release.preDomain.js
                    })
                });
        }

        fis
            .media('pre')
            .match('**.js', { //js添加域名和项目前缀
                url: '/' + this.config.projectPath,
                domain: this.config.release.preDomain.js
            })
            .match('**.{css,scss}', { //css添加域名和项目前缀
                url: '/' + this.config.projectPath,
                domain: this.config.release.preDomain.css
            })
            .match('::image', { //图片添加项目前缀
                url: '/' + this.config.projectPath
            })
            .match('/html/**.{html,ftl}', {
                parser: null
            })
            .match('/html/**.ftl', {
                rExt: '.ftl'
            })
            .match('*', {
                deploy: [
                    fis.plugin('gfe-combo-url', {
                        useCombo: this.config.release.urlCombo
                    }),
                    fis.plugin('gfe-script-inbottom'),
                    fis.plugin('gfe-script-place'),
                    fis.plugin('gfe-replace', {
                        patterns: [{
                            match: '__JS_DOMAIN__',
                            replacement: this.config.release.preDomain.js
                        }, {
                            match: '__CSS_DOMAIN__',
                            replacement: this.config.release.preDomain.css
                        }]
                    }),
                    fis.plugin('local-deliver', {
                        to: './build'
                    })
                ]
            });
    },
    /**
     * 设置prd环境配置
     */
    _setPrdEvnConfig: function() {
        //是否开启debug输出
        if (this.config.release.debug) {
            fis
                .media('prd')
                .match('::package', {
                    //输出debug文件
                    prepackager: fis.plugin('gfe-debug-output', {
                        cssDomain: this.config.release.prdDomain.css,
                        jsDomain: this.config.release.prdDomain.js,
                        debugDomain: this.config.release.debugDomain
                    })
                });
        }


        fis
            .media('prd')
            .match('**.js', { //js添加域名和项目前缀
                url: '/' + this.config.projectPath,
                domain: this.config.release.prdDomain.js
            })
            .match('**.{css,scss}', { //css添加域名和项目前缀
                url: '/' + this.config.projectPath,
                domain: this.config.release.prdDomain.css
            })
            .match('::image', { //图片添加项目前缀
                url: '/' + this.config.projectPath
            })
            .match('/html/**.{html,ftl}', {
                parser: null
            })
            .match('/html/**.ftl', {
                rExt: '.ftl'
            })
            .match('*', {
                deploy: [
                    fis.plugin('gfe-combo-url', {
                        useCombo: this.config.release.urlCombo
                    }),
                    fis.plugin('gfe-script-inbottom'),
                    fis.plugin('gfe-script-place'),
                    fis.plugin('gfe-replace', {
                        patterns: [{
                            match: '__JS_DOMAIN__',
                            replacement: this.config.release.prdDomain.js
                        }, {
                            match: '__CSS_DOMAIN__',
                            replacement: this.config.release.prdDomain.css
                        }]
                    }),
                    fis.plugin('local-deliver', {
                        to: './build'
                    })
                ]
            });
    },
    /**
     * 获取配置文件
     */
    _getConfig: function() {
        var config = require('./lib/defaults.js');
        var gfeConfigPath = path.join(process.cwd(), 'gfe-config.json');
        if (_.exists(gfeConfigPath)) {
            var gfeConfig = _.readJSON(gfeConfigPath);
            config = _.merge(config, gfeConfig);
        } else {
            _.write(gfeConfigPath, JSON.stringify(config, null, 4), 'utf-8');
        }

        return config;
    }
};

gfis.init();
