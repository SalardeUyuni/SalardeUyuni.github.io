// 实现这个项目的构建任务
const { src, dest, parallel, series, watch } = require('gulp')

const minimist = require('minimist')

const eslint =require('gulp-eslint')
//自动加载所有的gulp插件
const loadPlugins = require('gulp-load-plugins')
const plugins = loadPlugins()

// 清除指定的文件
const del = require('del')
const clean = () => {
    return del(['dist', 'temp'])
}

// 准备开发服务器
const browserSync = require('browser-sync')
const bs = browserSync.create()

// 任务：代码风格校验
const lint = () => {
    return src(['src/assets/scripts/*.js'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
}

// 任务：样式编译
const style = () => {
    return src('src/assets/styles/*.scss', { base: 'src' })
        .pipe(plugins.sass({ outputStyle: 'expanded' }))
        .pipe(dest('temp'))
        .pipe(bs.reload({ stream: true }))//以流的方式往浏览器推，更新页面
}

// 任务：脚本编译
const script = () => {
    return src('src/assets/scripts/*.js', { base: 'src' })
        .pipe(plugins.babel({ presets: ['@babel/preset-env'] }))//presets必须指定，否则转换没有效果
        .pipe(dest('temp'))
        .pipe(bs.reload({ stream: true }))
}

// 任务：页面模板编译（以swig模板引擎为例，需要安装他的转换插件gulp-swig）
const data = {
    menus: [
        {
            name: 'Home',
            icon: 'aperture',
            link: 'index.html'
        },
        {
            name: 'Features',
            link: 'features.html'
        },
        {
            name: 'About',
            link: 'about.html'
        },
        {
            name: 'Contact',
            link: '#',
            children: [
                {
                    name: 'Twitter',
                    link: 'https://twitter.com/w_zce'
                },
                {
                    name: 'About',
                    link: 'https://weibo.com/zceme'
                },
                {
                    name: 'divider'
                },
                {
                    name: 'About',
                    link: 'https://github.com/zce'
                }
            ]
        }
    ],
    pkg: require('./package.json'),
    date: new Date()
}
const page = () => {
    return src('src/*.html', { base: 'src' })
        .pipe(plugins.swig({ data, defaults: { cache: false } })) // 防止模板缓存导致页面不能及时更新
        .pipe(dest('temp'))
        .pipe(bs.reload({ stream: true }))
}

// 任务：图片文件转换
const image = () => {
    return src('src/assets/images/**', { base: 'src' })
        .pipe(plugins.imagemin())
        .pipe(dest('dist'))
}

// 任务：字体文件转换
const font = () => {
    return src('src/assets/fonts/**', { base: 'src' })
        .pipe(plugins.imagemin())
        .pipe(dest('dist'))
}

// 任务：拷贝其他文件
const extra = () => {
    return src('public/**', { base: 'public' })
        .pipe(dest('dist'))
}

// 任务：开启一个开发服务器
const serve = () => {
    // 监视文件变化，执行对应的任务
    watch('src/assets/styles/*.scss', style)
    watch('src/assets/scripts/*.js', script)
    watch('src/*.html', page)
    watch([
        'src/assets/images/**',
        'src/assets/fonts/**',
        'public/**'
    ], bs.reload)//reload会重新发起对资源的请求

    // 初始化服务器
    bs.init({
        notify: false,//是否开启连接成功提示
        port: 2080,
        // open: false,//是否自动打开浏览器
        // files: 'dist/**',//设置监听哪些文件发生改变时需要刷新
        server: {
            baseDir: ['temp', 'src', 'public'],//设置网页服务器根目录'dist'，如果值是一个数组的格式，如果访问的资源没找到则会依次往后查找；这样主要是为了开发阶段不打包图片字体等静态文件，直接去源文件夹找，提高开发效率
            routes: { // routes的优先级高于baseDir；routes主要用来解决开发时引用的node-modules路径找不到的问题；
                '/node_modules': 'node_modules'
            }
        }
    })
}

// 任务：合并引用，减小依赖的文件个数，从而减少浏览器发起的请求次数
const useref = () => {
    return src('temp/*.html', { base: 'temp' })
        .pipe(plugins.useref({ searchPath: ['temp', '.'] }))//数组表示查找顺序，最常用的优先写在前面，.表示根目录；可以解决打包上线时引用的node-modules路径找不到的问题
        // html js css
        .pipe(plugins.if(/\.js$/, plugins.uglify()))//压缩js
        .pipe(plugins.if(/\.css$/, plugins.cleanCss()))//压缩css
        .pipe(plugins.if(/\.html$/, plugins.htmlmin({//压缩html，默认只删除空格
            collapseWhitespace: true,
            minifyCSS: true,
            minifyJS: true
        })))
        .pipe(dest('dist'))
}

// 任务：上传
const argv = minimist(process.argv.slice(2))
const upload = () => {
    return src('**', { cwd: 'dist' })
        .pipe(
            plugins.ghPages({
                branch: argv.branch === undefined ? 'gh-pages' : argv.branch
            })
        )
}

// 组合任务：编译
const compile = parallel(style, script, page)

// 组合任务：开发调试
const start = series(compile, serve)

// 组合任务：打包
const build = series(
    clean,
    parallel(
        series(compile, useref),
        image,
        font,
        extra
    )
)

// 组合任务：部署
const deploy = series(build, upload)


module.exports = {
    clean,
    serve,
    start,
    build,
    lint,
    deploy
}
