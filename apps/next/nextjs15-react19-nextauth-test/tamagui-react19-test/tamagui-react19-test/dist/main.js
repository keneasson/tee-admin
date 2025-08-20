/*! For license information please see main.js.LICENSE.txt */
;(() => {
  var e = {
      9899: (e) => {
        'use strict'
        function t(e, t, n) {
          return (
            n < 0 && (n += 1),
            n > 1 && (n -= 1),
            n < 1 / 6
              ? e + 6 * (t - e) * n
              : n < 0.5
                ? t
                : n < 2 / 3
                  ? e + (t - e) * (2 / 3 - n) * 6
                  : e
          )
        }
        function n(e, n, r) {
          const o = r < 0.5 ? r * (1 + n) : r + n - r * n,
            a = 2 * r - o,
            l = t(a, o, e + 1 / 3),
            i = t(a, o, e),
            s = t(a, o, e - 1 / 3)
          return (
            (Math.round(255 * l) << 24) | (Math.round(255 * i) << 16) | (Math.round(255 * s) << 8)
          )
        }
        const r = '[-+]?\\d*\\.?\\d+',
          o = r + '%'
        function a(...e) {
          return '\\(\\s*(' + e.join(')\\s*,?\\s*(') + ')\\s*\\)'
        }
        function l(...e) {
          return (
            '\\(\\s*(' +
            e.slice(0, e.length - 1).join(')\\s*,?\\s*(') +
            ')\\s*/\\s*(' +
            e[e.length - 1] +
            ')\\s*\\)'
          )
        }
        function i(...e) {
          return '\\(\\s*(' + e.join(')\\s*,\\s*(') + ')\\s*\\)'
        }
        let s
        function u(e) {
          const t = parseInt(e, 10)
          return t < 0 ? 0 : t > 255 ? 255 : t
        }
        function c(e) {
          return (((parseFloat(e) % 360) + 360) % 360) / 360
        }
        function d(e) {
          const t = parseFloat(e)
          return t < 0 ? 0 : t > 1 ? 255 : Math.round(255 * t)
        }
        function f(e) {
          const t = parseFloat(e)
          return t < 0 ? 0 : t > 100 ? 1 : t / 100
        }
        e.exports = function (e) {
          if ('number' == typeof e) return e >>> 0 === e && e >= 0 && e <= 4294967295 ? e : null
          if ('string' != typeof e) return null
          const p =
            (void 0 === s &&
              (s = {
                rgb: new RegExp('rgb' + a(r, r, r)),
                rgba: new RegExp('rgba(' + i(r, r, r, r) + '|' + l(r, r, r, r) + ')'),
                hsl: new RegExp('hsl' + a(r, o, o)),
                hsla: new RegExp('hsla(' + i(r, o, o, r) + '|' + l(r, o, o, r) + ')'),
                hwb: new RegExp('hwb' + a(r, o, o)),
                hex3: /^#([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
                hex4: /^#([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
                hex6: /^#([0-9a-fA-F]{6})$/,
                hex8: /^#([0-9a-fA-F]{8})$/,
              }),
            s)
          let m
          if ((m = p.hex6.exec(e))) return parseInt(m[1] + 'ff', 16) >>> 0
          const b = (function (e) {
            switch (e) {
              case 'transparent':
                return 0
              case 'aliceblue':
                return 4042850303
              case 'antiquewhite':
                return 4209760255
              case 'aqua':
              case 'cyan':
                return 16777215
              case 'aquamarine':
                return 2147472639
              case 'azure':
                return 4043309055
              case 'beige':
                return 4126530815
              case 'bisque':
                return 4293182719
              case 'black':
                return 255
              case 'blanchedalmond':
                return 4293643775
              case 'blue':
                return 65535
              case 'blueviolet':
                return 2318131967
              case 'brown':
                return 2771004159
              case 'burlywood':
                return 3736635391
              case 'burntsienna':
                return 3934150143
              case 'cadetblue':
                return 1604231423
              case 'chartreuse':
                return 2147418367
              case 'chocolate':
                return 3530104575
              case 'coral':
                return 4286533887
              case 'cornflowerblue':
                return 1687547391
              case 'cornsilk':
                return 4294499583
              case 'crimson':
                return 3692313855
              case 'darkblue':
                return 35839
              case 'darkcyan':
                return 9145343
              case 'darkgoldenrod':
                return 3095792639
              case 'darkgray':
              case 'darkgrey':
                return 2846468607
              case 'darkgreen':
                return 6553855
              case 'darkkhaki':
                return 3182914559
              case 'darkmagenta':
                return 2332068863
              case 'darkolivegreen':
                return 1433087999
              case 'darkorange':
                return 4287365375
              case 'darkorchid':
                return 2570243327
              case 'darkred':
                return 2332033279
              case 'darksalmon':
                return 3918953215
              case 'darkseagreen':
                return 2411499519
              case 'darkslateblue':
                return 1211993087
              case 'darkslategray':
              case 'darkslategrey':
                return 793726975
              case 'darkturquoise':
                return 13554175
              case 'darkviolet':
                return 2483082239
              case 'deeppink':
                return 4279538687
              case 'deepskyblue':
                return 12582911
              case 'dimgray':
              case 'dimgrey':
                return 1768516095
              case 'dodgerblue':
                return 512819199
              case 'firebrick':
                return 2988581631
              case 'floralwhite':
                return 4294635775
              case 'forestgreen':
                return 579543807
              case 'fuchsia':
              case 'magenta':
                return 4278255615
              case 'gainsboro':
                return 3705462015
              case 'ghostwhite':
                return 4177068031
              case 'gold':
                return 4292280575
              case 'goldenrod':
                return 3668254975
              case 'gray':
              case 'grey':
                return 2155905279
              case 'green':
                return 8388863
              case 'greenyellow':
                return 2919182335
              case 'honeydew':
                return 4043305215
              case 'hotpink':
                return 4285117695
              case 'indianred':
                return 3445382399
              case 'indigo':
                return 1258324735
              case 'ivory':
                return 4294963455
              case 'khaki':
                return 4041641215
              case 'lavender':
                return 3873897215
              case 'lavenderblush':
                return 4293981695
              case 'lawngreen':
                return 2096890111
              case 'lemonchiffon':
                return 4294626815
              case 'lightblue':
                return 2916673279
              case 'lightcoral':
                return 4034953471
              case 'lightcyan':
                return 3774873599
              case 'lightgoldenrodyellow':
                return 4210742015
              case 'lightgray':
              case 'lightgrey':
                return 3553874943
              case 'lightgreen':
                return 2431553791
              case 'lightpink':
                return 4290167295
              case 'lightsalmon':
                return 4288707327
              case 'lightseagreen':
                return 548580095
              case 'lightskyblue':
                return 2278488831
              case 'lightslategray':
              case 'lightslategrey':
                return 2005441023
              case 'lightsteelblue':
                return 2965692159
              case 'lightyellow':
                return 4294959359
              case 'lime':
                return 16711935
              case 'limegreen':
                return 852308735
              case 'linen':
                return 4210091775
              case 'maroon':
                return 2147483903
              case 'mediumaquamarine':
                return 1724754687
              case 'mediumblue':
                return 52735
              case 'mediumorchid':
                return 3126187007
              case 'mediumpurple':
                return 2473647103
              case 'mediumseagreen':
                return 1018393087
              case 'mediumslateblue':
                return 2070474495
              case 'mediumspringgreen':
                return 16423679
              case 'mediumturquoise':
                return 1221709055
              case 'mediumvioletred':
                return 3340076543
              case 'midnightblue':
                return 421097727
              case 'mintcream':
                return 4127193855
              case 'mistyrose':
                return 4293190143
              case 'moccasin':
                return 4293178879
              case 'navajowhite':
                return 4292783615
              case 'navy':
                return 33023
              case 'oldlace':
                return 4260751103
              case 'olive':
                return 2155872511
              case 'olivedrab':
                return 1804477439
              case 'orange':
                return 4289003775
              case 'orangered':
                return 4282712319
              case 'orchid':
                return 3664828159
              case 'palegoldenrod':
                return 4008225535
              case 'palegreen':
                return 2566625535
              case 'paleturquoise':
                return 2951671551
              case 'palevioletred':
                return 3681588223
              case 'papayawhip':
                return 4293907967
              case 'peachpuff':
                return 4292524543
              case 'peru':
                return 3448061951
              case 'pink':
                return 4290825215
              case 'plum':
                return 3718307327
              case 'powderblue':
                return 2967529215
              case 'purple':
                return 2147516671
              case 'rebeccapurple':
                return 1714657791
              case 'red':
                return 4278190335
              case 'rosybrown':
                return 3163525119
              case 'royalblue':
                return 1097458175
              case 'saddlebrown':
                return 2336560127
              case 'salmon':
                return 4202722047
              case 'sandybrown':
                return 4104413439
              case 'seagreen':
                return 780883967
              case 'seashell':
                return 4294307583
              case 'sienna':
                return 2689740287
              case 'silver':
                return 3233857791
              case 'skyblue':
                return 2278484991
              case 'slateblue':
                return 1784335871
              case 'slategray':
              case 'slategrey':
                return 1887473919
              case 'snow':
                return 4294638335
              case 'springgreen':
                return 16744447
              case 'steelblue':
                return 1182971135
              case 'tan':
                return 3535047935
              case 'teal':
                return 8421631
              case 'thistle':
                return 3636451583
              case 'tomato':
                return 4284696575
              case 'turquoise':
                return 1088475391
              case 'violet':
                return 4001558271
              case 'wheat':
                return 4125012991
              case 'white':
                return 4294967295
              case 'whitesmoke':
                return 4126537215
              case 'yellow':
                return 4294902015
              case 'yellowgreen':
                return 2597139199
            }
            return null
          })(e)
          return null != b
            ? b
            : (m = p.rgb.exec(e))
              ? ((u(m[1]) << 24) | (u(m[2]) << 16) | (u(m[3]) << 8) | 255) >>> 0
              : (m = p.rgba.exec(e))
                ? void 0 !== m[6]
                  ? ((u(m[6]) << 24) | (u(m[7]) << 16) | (u(m[8]) << 8) | d(m[9])) >>> 0
                  : ((u(m[2]) << 24) | (u(m[3]) << 16) | (u(m[4]) << 8) | d(m[5])) >>> 0
                : (m = p.hex3.exec(e))
                  ? parseInt(m[1] + m[1] + m[2] + m[2] + m[3] + m[3] + 'ff', 16) >>> 0
                  : (m = p.hex8.exec(e))
                    ? parseInt(m[1], 16) >>> 0
                    : (m = p.hex4.exec(e))
                      ? parseInt(m[1] + m[1] + m[2] + m[2] + m[3] + m[3] + m[4] + m[4], 16) >>> 0
                      : (m = p.hsl.exec(e))
                        ? (255 | n(c(m[1]), f(m[2]), f(m[3]))) >>> 0
                        : (m = p.hsla.exec(e))
                          ? void 0 !== m[6]
                            ? (n(c(m[6]), f(m[7]), f(m[8])) | d(m[9])) >>> 0
                            : (n(c(m[2]), f(m[3]), f(m[4])) | d(m[5])) >>> 0
                          : (m = p.hwb.exec(e))
                            ? (255 |
                                (function (e, n, r) {
                                  if (n + r >= 1) {
                                    const e = Math.round((255 * n) / (n + r))
                                    return (e << 24) | (e << 16) | (e << 8)
                                  }
                                  const o = t(0, 1, e + 1 / 3) * (1 - n - r) + n,
                                    a = t(0, 1, e) * (1 - n - r) + n,
                                    l = t(0, 1, e - 1 / 3) * (1 - n - r) + n
                                  return (
                                    (Math.round(255 * o) << 24) |
                                    (Math.round(255 * a) << 16) |
                                    (Math.round(255 * l) << 8)
                                  )
                                })(c(m[1]), f(m[2]), f(m[3]))) >>>
                              0
                            : null
        }
      },
      4612: (e) => {
        'use strict'
        function t(e, t, n) {
          return (
            n < 0 && (n += 1),
            n > 1 && (n -= 1),
            n < 1 / 6
              ? e + 6 * (t - e) * n
              : n < 0.5
                ? t
                : n < 2 / 3
                  ? e + (t - e) * (2 / 3 - n) * 6
                  : e
          )
        }
        function n(e, n, r) {
          const o = r < 0.5 ? r * (1 + n) : r + n - r * n,
            a = 2 * r - o,
            l = t(a, o, e + 1 / 3),
            i = t(a, o, e),
            s = t(a, o, e - 1 / 3)
          return (
            (Math.round(255 * l) << 24) | (Math.round(255 * i) << 16) | (Math.round(255 * s) << 8)
          )
        }
        const r = '[-+]?\\d*\\.?\\d+',
          o = r + '%'
        function a(...e) {
          return '\\(\\s*(' + e.join(')\\s*,?\\s*(') + ')\\s*\\)'
        }
        function l(...e) {
          return (
            '\\(\\s*(' +
            e.slice(0, e.length - 1).join(')\\s*,?\\s*(') +
            ')\\s*/\\s*(' +
            e[e.length - 1] +
            ')\\s*\\)'
          )
        }
        function i(...e) {
          return '\\(\\s*(' + e.join(')\\s*,\\s*(') + ')\\s*\\)'
        }
        let s
        function u(e) {
          const t = parseInt(e, 10)
          return t < 0 ? 0 : t > 255 ? 255 : t
        }
        function c(e) {
          return (((parseFloat(e) % 360) + 360) % 360) / 360
        }
        function d(e) {
          const t = parseFloat(e)
          return t < 0 ? 0 : t > 1 ? 255 : Math.round(255 * t)
        }
        function f(e) {
          const t = parseFloat(e)
          return t < 0 ? 0 : t > 100 ? 1 : t / 100
        }
        e.exports = function (e) {
          if ('number' == typeof e) return e >>> 0 === e && e >= 0 && e <= 4294967295 ? e : null
          if ('string' != typeof e) return null
          const p =
            (void 0 === s &&
              (s = {
                rgb: new RegExp('rgb' + a(r, r, r)),
                rgba: new RegExp('rgba(' + i(r, r, r, r) + '|' + l(r, r, r, r) + ')'),
                hsl: new RegExp('hsl' + a(r, o, o)),
                hsla: new RegExp('hsla(' + i(r, o, o, r) + '|' + l(r, o, o, r) + ')'),
                hwb: new RegExp('hwb' + a(r, o, o)),
                hex3: /^#([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
                hex4: /^#([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
                hex6: /^#([0-9a-fA-F]{6})$/,
                hex8: /^#([0-9a-fA-F]{8})$/,
              }),
            s)
          let m
          if ((m = p.hex6.exec(e))) return parseInt(m[1] + 'ff', 16) >>> 0
          const b = (function (e) {
            switch (e) {
              case 'transparent':
                return 0
              case 'aliceblue':
                return 4042850303
              case 'antiquewhite':
                return 4209760255
              case 'aqua':
              case 'cyan':
                return 16777215
              case 'aquamarine':
                return 2147472639
              case 'azure':
                return 4043309055
              case 'beige':
                return 4126530815
              case 'bisque':
                return 4293182719
              case 'black':
                return 255
              case 'blanchedalmond':
                return 4293643775
              case 'blue':
                return 65535
              case 'blueviolet':
                return 2318131967
              case 'brown':
                return 2771004159
              case 'burlywood':
                return 3736635391
              case 'burntsienna':
                return 3934150143
              case 'cadetblue':
                return 1604231423
              case 'chartreuse':
                return 2147418367
              case 'chocolate':
                return 3530104575
              case 'coral':
                return 4286533887
              case 'cornflowerblue':
                return 1687547391
              case 'cornsilk':
                return 4294499583
              case 'crimson':
                return 3692313855
              case 'darkblue':
                return 35839
              case 'darkcyan':
                return 9145343
              case 'darkgoldenrod':
                return 3095792639
              case 'darkgray':
              case 'darkgrey':
                return 2846468607
              case 'darkgreen':
                return 6553855
              case 'darkkhaki':
                return 3182914559
              case 'darkmagenta':
                return 2332068863
              case 'darkolivegreen':
                return 1433087999
              case 'darkorange':
                return 4287365375
              case 'darkorchid':
                return 2570243327
              case 'darkred':
                return 2332033279
              case 'darksalmon':
                return 3918953215
              case 'darkseagreen':
                return 2411499519
              case 'darkslateblue':
                return 1211993087
              case 'darkslategray':
              case 'darkslategrey':
                return 793726975
              case 'darkturquoise':
                return 13554175
              case 'darkviolet':
                return 2483082239
              case 'deeppink':
                return 4279538687
              case 'deepskyblue':
                return 12582911
              case 'dimgray':
              case 'dimgrey':
                return 1768516095
              case 'dodgerblue':
                return 512819199
              case 'firebrick':
                return 2988581631
              case 'floralwhite':
                return 4294635775
              case 'forestgreen':
                return 579543807
              case 'fuchsia':
              case 'magenta':
                return 4278255615
              case 'gainsboro':
                return 3705462015
              case 'ghostwhite':
                return 4177068031
              case 'gold':
                return 4292280575
              case 'goldenrod':
                return 3668254975
              case 'gray':
              case 'grey':
                return 2155905279
              case 'green':
                return 8388863
              case 'greenyellow':
                return 2919182335
              case 'honeydew':
                return 4043305215
              case 'hotpink':
                return 4285117695
              case 'indianred':
                return 3445382399
              case 'indigo':
                return 1258324735
              case 'ivory':
                return 4294963455
              case 'khaki':
                return 4041641215
              case 'lavender':
                return 3873897215
              case 'lavenderblush':
                return 4293981695
              case 'lawngreen':
                return 2096890111
              case 'lemonchiffon':
                return 4294626815
              case 'lightblue':
                return 2916673279
              case 'lightcoral':
                return 4034953471
              case 'lightcyan':
                return 3774873599
              case 'lightgoldenrodyellow':
                return 4210742015
              case 'lightgray':
              case 'lightgrey':
                return 3553874943
              case 'lightgreen':
                return 2431553791
              case 'lightpink':
                return 4290167295
              case 'lightsalmon':
                return 4288707327
              case 'lightseagreen':
                return 548580095
              case 'lightskyblue':
                return 2278488831
              case 'lightslategray':
              case 'lightslategrey':
                return 2005441023
              case 'lightsteelblue':
                return 2965692159
              case 'lightyellow':
                return 4294959359
              case 'lime':
                return 16711935
              case 'limegreen':
                return 852308735
              case 'linen':
                return 4210091775
              case 'maroon':
                return 2147483903
              case 'mediumaquamarine':
                return 1724754687
              case 'mediumblue':
                return 52735
              case 'mediumorchid':
                return 3126187007
              case 'mediumpurple':
                return 2473647103
              case 'mediumseagreen':
                return 1018393087
              case 'mediumslateblue':
                return 2070474495
              case 'mediumspringgreen':
                return 16423679
              case 'mediumturquoise':
                return 1221709055
              case 'mediumvioletred':
                return 3340076543
              case 'midnightblue':
                return 421097727
              case 'mintcream':
                return 4127193855
              case 'mistyrose':
                return 4293190143
              case 'moccasin':
                return 4293178879
              case 'navajowhite':
                return 4292783615
              case 'navy':
                return 33023
              case 'oldlace':
                return 4260751103
              case 'olive':
                return 2155872511
              case 'olivedrab':
                return 1804477439
              case 'orange':
                return 4289003775
              case 'orangered':
                return 4282712319
              case 'orchid':
                return 3664828159
              case 'palegoldenrod':
                return 4008225535
              case 'palegreen':
                return 2566625535
              case 'paleturquoise':
                return 2951671551
              case 'palevioletred':
                return 3681588223
              case 'papayawhip':
                return 4293907967
              case 'peachpuff':
                return 4292524543
              case 'peru':
                return 3448061951
              case 'pink':
                return 4290825215
              case 'plum':
                return 3718307327
              case 'powderblue':
                return 2967529215
              case 'purple':
                return 2147516671
              case 'rebeccapurple':
                return 1714657791
              case 'red':
                return 4278190335
              case 'rosybrown':
                return 3163525119
              case 'royalblue':
                return 1097458175
              case 'saddlebrown':
                return 2336560127
              case 'salmon':
                return 4202722047
              case 'sandybrown':
                return 4104413439
              case 'seagreen':
                return 780883967
              case 'seashell':
                return 4294307583
              case 'sienna':
                return 2689740287
              case 'silver':
                return 3233857791
              case 'skyblue':
                return 2278484991
              case 'slateblue':
                return 1784335871
              case 'slategray':
              case 'slategrey':
                return 1887473919
              case 'snow':
                return 4294638335
              case 'springgreen':
                return 16744447
              case 'steelblue':
                return 1182971135
              case 'tan':
                return 3535047935
              case 'teal':
                return 8421631
              case 'thistle':
                return 3636451583
              case 'tomato':
                return 4284696575
              case 'turquoise':
                return 1088475391
              case 'violet':
                return 4001558271
              case 'wheat':
                return 4125012991
              case 'white':
                return 4294967295
              case 'whitesmoke':
                return 4126537215
              case 'yellow':
                return 4294902015
              case 'yellowgreen':
                return 2597139199
            }
            return null
          })(e)
          return null != b
            ? b
            : (m = p.rgb.exec(e))
              ? ((u(m[1]) << 24) | (u(m[2]) << 16) | (u(m[3]) << 8) | 255) >>> 0
              : (m = p.rgba.exec(e))
                ? void 0 !== m[6]
                  ? ((u(m[6]) << 24) | (u(m[7]) << 16) | (u(m[8]) << 8) | d(m[9])) >>> 0
                  : ((u(m[2]) << 24) | (u(m[3]) << 16) | (u(m[4]) << 8) | d(m[5])) >>> 0
                : (m = p.hex3.exec(e))
                  ? parseInt(m[1] + m[1] + m[2] + m[2] + m[3] + m[3] + 'ff', 16) >>> 0
                  : (m = p.hex8.exec(e))
                    ? parseInt(m[1], 16) >>> 0
                    : (m = p.hex4.exec(e))
                      ? parseInt(m[1] + m[1] + m[2] + m[2] + m[3] + m[3] + m[4] + m[4], 16) >>> 0
                      : (m = p.hsl.exec(e))
                        ? (255 | n(c(m[1]), f(m[2]), f(m[3]))) >>> 0
                        : (m = p.hsla.exec(e))
                          ? void 0 !== m[6]
                            ? (n(c(m[6]), f(m[7]), f(m[8])) | d(m[9])) >>> 0
                            : (n(c(m[2]), f(m[3]), f(m[4])) | d(m[5])) >>> 0
                          : (m = p.hwb.exec(e))
                            ? (255 |
                                (function (e, n, r) {
                                  if (n + r >= 1) {
                                    const e = Math.round((255 * n) / (n + r))
                                    return (e << 24) | (e << 16) | (e << 8)
                                  }
                                  const o = t(0, 1, e + 1 / 3) * (1 - n - r) + n,
                                    a = t(0, 1, e) * (1 - n - r) + n,
                                    l = t(0, 1, e - 1 / 3) * (1 - n - r) + n
                                  return (
                                    (Math.round(255 * o) << 24) |
                                    (Math.round(255 * a) << 16) |
                                    (Math.round(255 * l) << 8)
                                  )
                                })(c(m[1]), f(m[2]), f(m[3]))) >>>
                              0
                            : null
        }
      },
      7260: () => {
        void 0 === globalThis.__DEV__ && (globalThis.__DEV__ = !1)
      },
      3847: (e, t, n) => {
        'use strict'
        function r(e) {
          return (r =
            'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
              ? function (e) {
                  return typeof e
                }
              : function (e) {
                  return e &&
                    'function' == typeof Symbol &&
                    e.constructor === Symbol &&
                    e !== Symbol.prototype
                    ? 'symbol'
                    : typeof e
                })(e)
        }
        function o(e, t) {
          ;(null == t || t > e.length) && (t = e.length)
          for (var n = 0, r = new Array(t); n < t; n++) r[n] = e[n]
          return r
        }
        function a(e) {
          return e.filter(function (t, n) {
            return e.lastIndexOf(t) === n
          })
        }
        function l(e) {
          for (var t = 0, n = arguments.length <= 1 ? 0 : arguments.length - 1; t < n; ++t) {
            var i = t + 1 < 1 || arguments.length <= t + 1 ? void 0 : arguments[t + 1]
            for (var s in i) {
              var u = i[s],
                c = e[s]
              if (c && u) {
                if (Array.isArray(c)) {
                  e[s] = a(c.concat(u))
                  continue
                }
                if (Array.isArray(u)) {
                  e[s] = a(
                    [c].concat(
                      (function (e) {
                        if (Array.isArray(e)) return o(e)
                      })((d = u)) ||
                        (function (e) {
                          if ('undefined' != typeof Symbol && Symbol.iterator in Object(e))
                            return Array.from(e)
                        })(d) ||
                        (function (e, t) {
                          if (e) {
                            if ('string' == typeof e) return o(e, t)
                            var n = Object.prototype.toString.call(e).slice(8, -1)
                            return (
                              'Object' === n && e.constructor && (n = e.constructor.name),
                              'Map' === n || 'Set' === n
                                ? Array.from(n)
                                : 'Arguments' === n ||
                                    /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)
                                  ? o(e, t)
                                  : void 0
                            )
                          }
                        })(d) ||
                        (function () {
                          throw new TypeError(
                            'Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
                          )
                        })()
                    )
                  )
                  continue
                }
                if ('object' === r(u)) {
                  e[s] = l({}, c, u)
                  continue
                }
              }
              e[s] = u
            }
          }
          var d
          return e
        }
        ;(n.r(t),
          n.d(t, {
            assignStyle: () => l,
            camelCaseProperty: () => d,
            cssifyDeclaration: () => m,
            cssifyObject: () => b,
            hyphenateProperty: () => p,
            isPrefixedProperty: () => g,
            isPrefixedValue: () => v,
            isUnitlessProperty: () => T,
            normalizeProperty: () => M,
            resolveArrayValue: () => A,
            unprefixProperty: () => N,
            unprefixValue: () => z,
          }))
        var i = /-([a-z])/g,
          s = /^Ms/g,
          u = {}
        function c(e) {
          return e[1].toUpperCase()
        }
        function d(e) {
          if (u.hasOwnProperty(e)) return u[e]
          var t = e.replace(i, c).replace(s, 'ms')
          return ((u[e] = t), t)
        }
        var f = n(9276)
        function p(e) {
          return (0, f.default)(e)
        }
        function m(e, t) {
          return p(e) + ':' + t
        }
        function b(e) {
          var t = ''
          for (var n in e) {
            var r = e[n]
            ;('string' != typeof r && 'number' != typeof r) || (t && (t += ';'), (t += m(n, r)))
          }
          return t
        }
        var h = /^(Webkit|Moz|O|ms)/
        function g(e) {
          return h.test(e)
        }
        var y = /-webkit-|-moz-|-ms-/
        function v(e) {
          return 'string' == typeof e && y.test(e)
        }
        var S = {
            borderImageOutset: !0,
            borderImageSlice: !0,
            borderImageWidth: !0,
            fontWeight: !0,
            lineHeight: !0,
            opacity: !0,
            orphans: !0,
            tabSize: !0,
            widows: !0,
            zIndex: !0,
            zoom: !0,
            fillOpacity: !0,
            floodOpacity: !0,
            stopOpacity: !0,
            strokeDasharray: !0,
            strokeDashoffset: !0,
            strokeMiterlimit: !0,
            strokeOpacity: !0,
            strokeWidth: !0,
          },
          w = [
            'animationIterationCount',
            'boxFlex',
            'boxFlexGroup',
            'boxOrdinalGroup',
            'columnCount',
            'flex',
            'flexGrow',
            'flexPositive',
            'flexShrink',
            'flexNegative',
            'flexOrder',
            'gridColumn',
            'gridColumnEnd',
            'gridColumnStart',
            'gridRow',
            'gridRowEnd',
            'gridRowStart',
            'lineClamp',
            'order',
          ],
          O = ['Webkit', 'ms', 'Moz', 'O']
        function k(e, t) {
          return e + t.charAt(0).toUpperCase() + t.slice(1)
        }
        for (var x = 0, P = w.length; x < P; ++x) {
          var _ = w[x]
          S[_] = !0
          for (var C = 0, E = O.length; C < E; ++C) S[k(O[C], _)] = !0
        }
        for (var j in S) S[p(j)] = !0
        function T(e) {
          return S.hasOwnProperty(e)
        }
        var R = /^(ms|Webkit|Moz|O)/
        function N(e) {
          var t = e.replace(R, '')
          return t.charAt(0).toLowerCase() + t.slice(1)
        }
        function M(e) {
          return N(d(e))
        }
        function A(e, t) {
          return t.join(';' + p(e) + ':')
        }
        var D = /(-ms-|-webkit-|-moz-|-o-)/g
        function z(e) {
          return 'string' == typeof e ? e.replace(D, '') : e
        }
      },
      6978: (e, t, n) => {
        'use strict'
        ;(Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.default = function (e) {
            return (0, o.default)(e)
          }))
        var r,
          o = (r = n(9276)) && r.__esModule ? r : { default: r }
      },
      2337: (e, t) => {
        'use strict'
        ;(Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.default = function (e) {
            return 'string' == typeof e && n.test(e)
          }))
        var n = /-webkit-|-moz-|-ms-/
      },
      9276: (e, t, n) => {
        'use strict'
        ;(n.r(t), n.d(t, { default: () => i }))
        var r = /[A-Z]/g,
          o = /^ms-/,
          a = {}
        function l(e) {
          return '-' + e.toLowerCase()
        }
        const i = function (e) {
          if (a.hasOwnProperty(e)) return a[e]
          var t = e.replace(r, l)
          return (a[e] = o.test(t) ? '-' + t : t)
        }
      },
      8628: (e, t, n) => {
        'use strict'
        t.A = function (e) {
          var t = e.prefixMap,
            n = e.plugins
          return function e(i) {
            for (var s in i) {
              var u = i[s]
              if ((0, l.default)(u)) i[s] = e(u)
              else if (Array.isArray(u)) {
                for (var c = [], d = 0, f = u.length; d < f; ++d) {
                  var p = (0, o.default)(n, s, u[d], i, t)
                  ;(0, a.default)(c, p || u[d])
                }
                c.length > 0 && (i[s] = c)
              } else {
                var m = (0, o.default)(n, s, u, i, t)
                ;(m && (i[s] = m), (i = (0, r.default)(t, s, i)))
              }
            }
            return i
          }
        }
        var r = i(n(9364)),
          o = i(n(2400)),
          a = i(n(706)),
          l = i(n(2098))
        function i(e) {
          return e && e.__esModule ? e : { default: e }
        }
      },
      9582: (e, t, n) => {
        'use strict'
        t.A = function (e, t) {
          if ('string' == typeof t && !(0, r.isPrefixedValue)(t) && -1 !== t.indexOf('cross-fade('))
            return a.map(function (e) {
              return t.replace(o, e + 'cross-fade(')
            })
        }
        var r = n(3847),
          o = /cross-fade\(/g,
          a = ['-webkit-', '']
      },
      7829: (e, t, n) => {
        'use strict'
        t.A = function (e, t) {
          if ('string' == typeof t && !(0, o.default)(t) && t.indexOf('image-set(') > -1)
            return a.map(function (e) {
              return t.replace(/image-set\(/g, e + 'image-set(')
            })
        }
        var r,
          o = (r = n(2337)) && r.__esModule ? r : { default: r },
          a = ['-webkit-', '']
      },
      3507: (e, t) => {
        'use strict'
        t.A = function (e, t, r) {
          if (Object.prototype.hasOwnProperty.call(n, e))
            for (var o = n[e], a = 0, l = o.length; a < l; ++a) r[o[a]] = t
        }
        var n = {
          marginBlockStart: ['WebkitMarginBefore'],
          marginBlockEnd: ['WebkitMarginAfter'],
          marginInlineStart: ['WebkitMarginStart', 'MozMarginStart'],
          marginInlineEnd: ['WebkitMarginEnd', 'MozMarginEnd'],
          paddingBlockStart: ['WebkitPaddingBefore'],
          paddingBlockEnd: ['WebkitPaddingAfter'],
          paddingInlineStart: ['WebkitPaddingStart', 'MozPaddingStart'],
          paddingInlineEnd: ['WebkitPaddingEnd', 'MozPaddingEnd'],
          borderBlockStart: ['WebkitBorderBefore'],
          borderBlockStartColor: ['WebkitBorderBeforeColor'],
          borderBlockStartStyle: ['WebkitBorderBeforeStyle'],
          borderBlockStartWidth: ['WebkitBorderBeforeWidth'],
          borderBlockEnd: ['WebkitBorderAfter'],
          borderBlockEndColor: ['WebkitBorderAfterColor'],
          borderBlockEndStyle: ['WebkitBorderAfterStyle'],
          borderBlockEndWidth: ['WebkitBorderAfterWidth'],
          borderInlineStart: ['WebkitBorderStart', 'MozBorderStart'],
          borderInlineStartColor: ['WebkitBorderStartColor', 'MozBorderStartColor'],
          borderInlineStartStyle: ['WebkitBorderStartStyle', 'MozBorderStartStyle'],
          borderInlineStartWidth: ['WebkitBorderStartWidth', 'MozBorderStartWidth'],
          borderInlineEnd: ['WebkitBorderEnd', 'MozBorderEnd'],
          borderInlineEndColor: ['WebkitBorderEndColor', 'MozBorderEndColor'],
          borderInlineEndStyle: ['WebkitBorderEndStyle', 'MozBorderEndStyle'],
          borderInlineEndWidth: ['WebkitBorderEndWidth', 'MozBorderEndWidth'],
        }
      },
      9629: (e, t) => {
        'use strict'
        t.A = function (e, t) {
          if ('position' === e && 'sticky' === t) return ['-webkit-sticky', 'sticky']
        }
      },
      6908: (e, t) => {
        'use strict'
        t.A = function (e, t) {
          if (r.hasOwnProperty(e) && o.hasOwnProperty(t))
            return n.map(function (e) {
              return e + t
            })
        }
        var n = ['-webkit-', '-moz-', ''],
          r = {
            maxHeight: !0,
            maxWidth: !0,
            width: !0,
            height: !0,
            columnWidth: !0,
            minWidth: !0,
            minHeight: !0,
          },
          o = {
            'min-content': !0,
            'max-content': !0,
            'fill-available': !0,
            'fit-content': !0,
            'contain-floats': !0,
          }
      },
      349: (e, t, n) => {
        'use strict'
        t.A = function (e, t, n, l) {
          if ('string' == typeof t && i.hasOwnProperty(e)) {
            var u = (function (e, t) {
                if ((0, o.default)(e)) return e
                for (
                  var n = e.split(/,(?![^()]*(?:\([^()]*\))?\))/g), a = 0, l = n.length;
                  a < l;
                  ++a
                ) {
                  var i = n[a],
                    u = [i]
                  for (var c in t) {
                    var d = (0, r.default)(c)
                    if (i.indexOf(d) > -1 && 'order' !== d)
                      for (var f = t[c], p = 0, m = f.length; p < m; ++p)
                        u.unshift(i.replace(d, s[f[p]] + d))
                  }
                  n[a] = u.join(',')
                }
                return n.join(',')
              })(t, l),
              c = u
                .split(/,(?![^()]*(?:\([^()]*\))?\))/g)
                .filter(function (e) {
                  return !/-moz-|-ms-/.test(e)
                })
                .join(',')
            if (e.indexOf('Webkit') > -1) return c
            var d = u
              .split(/,(?![^()]*(?:\([^()]*\))?\))/g)
              .filter(function (e) {
                return !/-webkit-|-ms-/.test(e)
              })
              .join(',')
            return e.indexOf('Moz') > -1
              ? d
              : ((n['Webkit' + (0, a.default)(e)] = c), (n['Moz' + (0, a.default)(e)] = d), u)
          }
        }
        var r = l(n(6978)),
          o = l(n(2337)),
          a = l(n(5802))
        function l(e) {
          return e && e.__esModule ? e : { default: e }
        }
        var i = {
            transition: !0,
            transitionProperty: !0,
            WebkitTransition: !0,
            WebkitTransitionProperty: !0,
            MozTransition: !0,
            MozTransitionProperty: !0,
          },
          s = { Webkit: '-webkit-', Moz: '-moz-', ms: '-ms-' }
      },
      706: (e, t) => {
        'use strict'
        function n(e, t) {
          ;-1 === e.indexOf(t) && e.push(t)
        }
        ;(Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.default = function (e, t) {
            if (Array.isArray(t)) for (var r = 0, o = t.length; r < o; ++r) n(e, t[r])
            else n(e, t)
          }))
      },
      5802: (e, t) => {
        'use strict'
        ;(Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.default = function (e) {
            return e.charAt(0).toUpperCase() + e.slice(1)
          }))
      },
      2098: (e, t) => {
        'use strict'
        ;(Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.default = function (e) {
            return e instanceof Object && !Array.isArray(e)
          }))
      },
      9364: (e, t, n) => {
        'use strict'
        ;(Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.default = function (e, t, n) {
            var r = e[t]
            if (r && n.hasOwnProperty(t))
              for (var a = (0, o.default)(t), l = 0; l < r.length; ++l) {
                var i = r[l] + a
                n[i] || (n[i] = n[t])
              }
            return n
          }))
        var r,
          o = (r = n(5802)) && r.__esModule ? r : { default: r }
      },
      2400: (e, t) => {
        'use strict'
        ;(Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.default = function (e, t, n, r, o) {
            for (var a = 0, l = e.length; a < l; ++a) {
              var i = e[a](t, n, r, o)
              if (i) return i
            }
          }))
      },
      9904: (e, t, n) => {
        'use strict'
        var r = n(9921),
          o = n(7527),
          a = n(7970)
        function l(e) {
          var t = 'https://react.dev/errors/' + e
          if (1 < arguments.length) {
            t += '?args[]=' + encodeURIComponent(arguments[1])
            for (var n = 2; n < arguments.length; n++)
              t += '&args[]=' + encodeURIComponent(arguments[n])
          }
          return (
            'Minified React error #' +
            e +
            '; visit ' +
            t +
            ' for the full message or use the non-minified dev environment for full errors and additional helpful warnings.'
          )
        }
        function i(e) {
          var t = e,
            n = e
          if (e.alternate) for (; t.return; ) t = t.return
          else {
            e = t
            do {
              ;(!!(4098 & (t = e).flags) && (n = t.return), (e = t.return))
            } while (e)
          }
          return 3 === t.tag ? n : null
        }
        function s(e) {
          if (13 === e.tag) {
            var t = e.memoizedState
            if ((null === t && null !== (e = e.alternate) && (t = e.memoizedState), null !== t))
              return t.dehydrated
          }
          return null
        }
        function u(e) {
          if (i(e) !== e) throw Error(l(188))
        }
        function c(e) {
          var t = e.tag
          if (5 === t || 26 === t || 27 === t || 6 === t) return e
          for (e = e.child; null !== e; ) {
            if (null !== (t = c(e))) return t
            e = e.sibling
          }
          return null
        }
        var d = Object.assign,
          f = Symbol.for('react.element'),
          p = Symbol.for('react.transitional.element'),
          m = Symbol.for('react.portal'),
          b = Symbol.for('react.fragment'),
          h = Symbol.for('react.strict_mode'),
          g = Symbol.for('react.profiler'),
          y = Symbol.for('react.provider'),
          v = Symbol.for('react.consumer'),
          S = Symbol.for('react.context'),
          w = Symbol.for('react.forward_ref'),
          O = Symbol.for('react.suspense'),
          k = Symbol.for('react.suspense_list'),
          x = Symbol.for('react.memo'),
          P = Symbol.for('react.lazy')
        Symbol.for('react.scope')
        var _ = Symbol.for('react.activity')
        ;(Symbol.for('react.legacy_hidden'), Symbol.for('react.tracing_marker'))
        var C = Symbol.for('react.memo_cache_sentinel')
        Symbol.for('react.view_transition')
        var E = Symbol.iterator
        function j(e) {
          return null === e || 'object' != typeof e
            ? null
            : 'function' == typeof (e = (E && e[E]) || e['@@iterator'])
              ? e
              : null
        }
        var T = Symbol.for('react.client.reference')
        function R(e) {
          if (null == e) return null
          if ('function' == typeof e)
            return e.$$typeof === T ? null : e.displayName || e.name || null
          if ('string' == typeof e) return e
          switch (e) {
            case b:
              return 'Fragment'
            case g:
              return 'Profiler'
            case h:
              return 'StrictMode'
            case O:
              return 'Suspense'
            case k:
              return 'SuspenseList'
            case _:
              return 'Activity'
          }
          if ('object' == typeof e)
            switch (e.$$typeof) {
              case m:
                return 'Portal'
              case S:
                return (e.displayName || 'Context') + '.Provider'
              case v:
                return (e._context.displayName || 'Context') + '.Consumer'
              case w:
                var t = e.render
                return (
                  (e = e.displayName) ||
                    (e =
                      '' !== (e = t.displayName || t.name || '')
                        ? 'ForwardRef(' + e + ')'
                        : 'ForwardRef'),
                  e
                )
              case x:
                return null !== (t = e.displayName || null) ? t : R(e.type) || 'Memo'
              case P:
                ;((t = e._payload), (e = e._init))
                try {
                  return R(e(t))
                } catch (e) {}
            }
          return null
        }
        var N = Array.isArray,
          M = o.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
          A = a.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
          D = { pending: !1, data: null, method: null, action: null },
          z = [],
          I = -1
        function $(e) {
          return { current: e }
        }
        function L(e) {
          0 > I || ((e.current = z[I]), (z[I] = null), I--)
        }
        function F(e, t) {
          ;(I++, (z[I] = e.current), (e.current = t))
        }
        var V = $(null),
          W = $(null),
          B = $(null),
          H = $(null)
        function U(e, t) {
          switch ((F(B, t), F(W, e), F(V, null), t.nodeType)) {
            case 9:
            case 11:
              e = (e = t.documentElement) && (e = e.namespaceURI) ? rd(e) : 0
              break
            default:
              if (((e = t.tagName), (t = t.namespaceURI))) e = od((t = rd(t)), e)
              else
                switch (e) {
                  case 'svg':
                    e = 1
                    break
                  case 'math':
                    e = 2
                    break
                  default:
                    e = 0
                }
          }
          ;(L(V), F(V, e))
        }
        function G() {
          ;(L(V), L(W), L(B))
        }
        function q(e) {
          null !== e.memoizedState && F(H, e)
          var t = V.current,
            n = od(t, e.type)
          t !== n && (F(W, e), F(V, n))
        }
        function X(e) {
          ;(W.current === e && (L(V), L(W)), H.current === e && (L(H), (qd._currentValue = D)))
        }
        var Y = Object.prototype.hasOwnProperty,
          K = r.unstable_scheduleCallback,
          Q = r.unstable_cancelCallback,
          Z = r.unstable_shouldYield,
          J = r.unstable_requestPaint,
          ee = r.unstable_now,
          te = r.unstable_getCurrentPriorityLevel,
          ne = r.unstable_ImmediatePriority,
          re = r.unstable_UserBlockingPriority,
          oe = r.unstable_NormalPriority,
          ae = r.unstable_LowPriority,
          le = r.unstable_IdlePriority,
          ie = r.log,
          se = r.unstable_setDisableYieldValue,
          ue = null,
          ce = null
        function de(e) {
          if (('function' == typeof ie && se(e), ce && 'function' == typeof ce.setStrictMode))
            try {
              ce.setStrictMode(ue, e)
            } catch (e) {}
        }
        var fe = Math.clz32
            ? Math.clz32
            : function (e) {
                return 0 == (e >>>= 0) ? 32 : (31 - ((pe(e) / me) | 0)) | 0
              },
          pe = Math.log,
          me = Math.LN2,
          be = 256,
          he = 4194304
        function ge(e) {
          var t = 42 & e
          if (0 !== t) return t
          switch (e & -e) {
            case 1:
              return 1
            case 2:
              return 2
            case 4:
              return 4
            case 8:
              return 8
            case 16:
              return 16
            case 32:
              return 32
            case 64:
              return 64
            case 128:
              return 128
            case 256:
            case 512:
            case 1024:
            case 2048:
            case 4096:
            case 8192:
            case 16384:
            case 32768:
            case 65536:
            case 131072:
            case 262144:
            case 524288:
            case 1048576:
            case 2097152:
              return 4194048 & e
            case 4194304:
            case 8388608:
            case 16777216:
            case 33554432:
              return 62914560 & e
            case 67108864:
              return 67108864
            case 134217728:
              return 134217728
            case 268435456:
              return 268435456
            case 536870912:
              return 536870912
            case 1073741824:
              return 0
            default:
              return e
          }
        }
        function ye(e, t, n) {
          var r = e.pendingLanes
          if (0 === r) return 0
          var o = 0,
            a = e.suspendedLanes,
            l = e.pingedLanes
          e = e.warmLanes
          var i = 134217727 & r
          return (
            0 !== i
              ? 0 != (r = i & ~a)
                ? (o = ge(r))
                : 0 != (l &= i)
                  ? (o = ge(l))
                  : n || (0 != (n = i & ~e) && (o = ge(n)))
              : 0 != (i = r & ~a)
                ? (o = ge(i))
                : 0 !== l
                  ? (o = ge(l))
                  : n || (0 != (n = r & ~e) && (o = ge(n))),
            0 === o
              ? 0
              : 0 === t ||
                  t === o ||
                  t & a ||
                  !((a = o & -o) >= (n = t & -t) || (32 === a && 4194048 & n))
                ? o
                : t
          )
        }
        function ve(e, t) {
          return !(e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t)
        }
        function Se(e, t) {
          switch (e) {
            case 1:
            case 2:
            case 4:
            case 8:
            case 64:
              return t + 250
            case 16:
            case 32:
            case 128:
            case 256:
            case 512:
            case 1024:
            case 2048:
            case 4096:
            case 8192:
            case 16384:
            case 32768:
            case 65536:
            case 131072:
            case 262144:
            case 524288:
            case 1048576:
            case 2097152:
              return t + 5e3
            default:
              return -1
          }
        }
        function we() {
          var e = be
          return (!(4194048 & (be <<= 1)) && (be = 256), e)
        }
        function Oe() {
          var e = he
          return (!(62914560 & (he <<= 1)) && (he = 4194304), e)
        }
        function ke(e) {
          for (var t = [], n = 0; 31 > n; n++) t.push(e)
          return t
        }
        function xe(e, t) {
          ;((e.pendingLanes |= t),
            268435456 !== t && ((e.suspendedLanes = 0), (e.pingedLanes = 0), (e.warmLanes = 0)))
        }
        function Pe(e, t, n) {
          ;((e.pendingLanes |= t), (e.suspendedLanes &= ~t))
          var r = 31 - fe(t)
          ;((e.entangledLanes |= t),
            (e.entanglements[r] = 1073741824 | e.entanglements[r] | (4194090 & n)))
        }
        function _e(e, t) {
          var n = (e.entangledLanes |= t)
          for (e = e.entanglements; n; ) {
            var r = 31 - fe(n),
              o = 1 << r
            ;((o & t) | (e[r] & t) && (e[r] |= t), (n &= ~o))
          }
        }
        function Ce(e) {
          switch (e) {
            case 2:
              e = 1
              break
            case 8:
              e = 4
              break
            case 32:
              e = 16
              break
            case 256:
            case 512:
            case 1024:
            case 2048:
            case 4096:
            case 8192:
            case 16384:
            case 32768:
            case 65536:
            case 131072:
            case 262144:
            case 524288:
            case 1048576:
            case 2097152:
            case 4194304:
            case 8388608:
            case 16777216:
            case 33554432:
              e = 128
              break
            case 268435456:
              e = 134217728
              break
            default:
              e = 0
          }
          return e
        }
        function Ee(e) {
          return 2 < (e &= -e) ? (8 < e ? (134217727 & e ? 32 : 268435456) : 8) : 2
        }
        function je() {
          var e = A.p
          return 0 !== e ? e : void 0 === (e = window.event) ? 32 : lf(e.type)
        }
        var Te = Math.random().toString(36).slice(2),
          Re = '__reactFiber$' + Te,
          Ne = '__reactProps$' + Te,
          Me = '__reactContainer$' + Te,
          Ae = '__reactEvents$' + Te,
          De = '__reactListeners$' + Te,
          ze = '__reactHandles$' + Te,
          Ie = '__reactResources$' + Te,
          $e = '__reactMarker$' + Te
        function Le(e) {
          ;(delete e[Re], delete e[Ne], delete e[Ae], delete e[De], delete e[ze])
        }
        function Fe(e) {
          var t = e[Re]
          if (t) return t
          for (var n = e.parentNode; n; ) {
            if ((t = n[Me] || n[Re])) {
              if (((n = t.alternate), null !== t.child || (null !== n && null !== n.child)))
                for (e = yd(e); null !== e; ) {
                  if ((n = e[Re])) return n
                  e = yd(e)
                }
              return t
            }
            n = (e = n).parentNode
          }
          return null
        }
        function Ve(e) {
          if ((e = e[Re] || e[Me])) {
            var t = e.tag
            if (5 === t || 6 === t || 13 === t || 26 === t || 27 === t || 3 === t) return e
          }
          return null
        }
        function We(e) {
          var t = e.tag
          if (5 === t || 26 === t || 27 === t || 6 === t) return e.stateNode
          throw Error(l(33))
        }
        function Be(e) {
          var t = e[Ie]
          return (t || (t = e[Ie] = { hoistableStyles: new Map(), hoistableScripts: new Map() }), t)
        }
        function He(e) {
          e[$e] = !0
        }
        var Ue = new Set(),
          Ge = {}
        function qe(e, t) {
          ;(Xe(e, t), Xe(e + 'Capture', t))
        }
        function Xe(e, t) {
          for (Ge[e] = t, e = 0; e < t.length; e++) Ue.add(t[e])
        }
        var Ye,
          Ke,
          Qe = RegExp(
            '^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$'
          ),
          Ze = {},
          Je = {}
        function et(e, t, n) {
          if (
            ((o = t),
            Y.call(Je, o) || (!Y.call(Ze, o) && (Qe.test(o) ? (Je[o] = !0) : ((Ze[o] = !0), 0))))
          )
            if (null === n) e.removeAttribute(t)
            else {
              switch (typeof n) {
                case 'undefined':
                case 'function':
                case 'symbol':
                  return void e.removeAttribute(t)
                case 'boolean':
                  var r = t.toLowerCase().slice(0, 5)
                  if ('data-' !== r && 'aria-' !== r) return void e.removeAttribute(t)
              }
              e.setAttribute(t, '' + n)
            }
          var o
        }
        function tt(e, t, n) {
          if (null === n) e.removeAttribute(t)
          else {
            switch (typeof n) {
              case 'undefined':
              case 'function':
              case 'symbol':
              case 'boolean':
                return void e.removeAttribute(t)
            }
            e.setAttribute(t, '' + n)
          }
        }
        function nt(e, t, n, r) {
          if (null === r) e.removeAttribute(n)
          else {
            switch (typeof r) {
              case 'undefined':
              case 'function':
              case 'symbol':
              case 'boolean':
                return void e.removeAttribute(n)
            }
            e.setAttributeNS(t, n, '' + r)
          }
        }
        function rt(e) {
          if (void 0 === Ye)
            try {
              throw Error()
            } catch (e) {
              var t = e.stack.trim().match(/\n( *(at )?)/)
              ;((Ye = (t && t[1]) || ''),
                (Ke =
                  -1 < e.stack.indexOf('\n    at')
                    ? ' (<anonymous>)'
                    : -1 < e.stack.indexOf('@')
                      ? '@unknown:0:0'
                      : ''))
            }
          return '\n' + Ye + e + Ke
        }
        var ot = !1
        function at(e, t) {
          if (!e || ot) return ''
          ot = !0
          var n = Error.prepareStackTrace
          Error.prepareStackTrace = void 0
          try {
            var r = {
              DetermineComponentFrameRoot: function () {
                try {
                  if (t) {
                    var n = function () {
                      throw Error()
                    }
                    if (
                      (Object.defineProperty(n.prototype, 'props', {
                        set: function () {
                          throw Error()
                        },
                      }),
                      'object' == typeof Reflect && Reflect.construct)
                    ) {
                      try {
                        Reflect.construct(n, [])
                      } catch (e) {
                        var r = e
                      }
                      Reflect.construct(e, [], n)
                    } else {
                      try {
                        n.call()
                      } catch (e) {
                        r = e
                      }
                      e.call(n.prototype)
                    }
                  } else {
                    try {
                      throw Error()
                    } catch (e) {
                      r = e
                    }
                    ;(n = e()) && 'function' == typeof n.catch && n.catch(function () {})
                  }
                } catch (e) {
                  if (e && r && 'string' == typeof e.stack) return [e.stack, r.stack]
                }
                return [null, null]
              },
            }
            r.DetermineComponentFrameRoot.displayName = 'DetermineComponentFrameRoot'
            var o = Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot, 'name')
            o &&
              o.configurable &&
              Object.defineProperty(r.DetermineComponentFrameRoot, 'name', {
                value: 'DetermineComponentFrameRoot',
              })
            var a = r.DetermineComponentFrameRoot(),
              l = a[0],
              i = a[1]
            if (l && i) {
              var s = l.split('\n'),
                u = i.split('\n')
              for (o = r = 0; r < s.length && !s[r].includes('DetermineComponentFrameRoot'); ) r++
              for (; o < u.length && !u[o].includes('DetermineComponentFrameRoot'); ) o++
              if (r === s.length || o === u.length)
                for (r = s.length - 1, o = u.length - 1; 1 <= r && 0 <= o && s[r] !== u[o]; ) o--
              for (; 1 <= r && 0 <= o; r--, o--)
                if (s[r] !== u[o]) {
                  if (1 !== r || 1 !== o)
                    do {
                      if ((r--, 0 > --o || s[r] !== u[o])) {
                        var c = '\n' + s[r].replace(' at new ', ' at ')
                        return (
                          e.displayName &&
                            c.includes('<anonymous>') &&
                            (c = c.replace('<anonymous>', e.displayName)),
                          c
                        )
                      }
                    } while (1 <= r && 0 <= o)
                  break
                }
            }
          } finally {
            ;((ot = !1), (Error.prepareStackTrace = n))
          }
          return (n = e ? e.displayName || e.name : '') ? rt(n) : ''
        }
        function lt(e) {
          switch (e.tag) {
            case 26:
            case 27:
            case 5:
              return rt(e.type)
            case 16:
              return rt('Lazy')
            case 13:
              return rt('Suspense')
            case 19:
              return rt('SuspenseList')
            case 0:
            case 15:
              return at(e.type, !1)
            case 11:
              return at(e.type.render, !1)
            case 1:
              return at(e.type, !0)
            case 31:
              return rt('Activity')
            default:
              return ''
          }
        }
        function it(e) {
          try {
            var t = ''
            do {
              ;((t += lt(e)), (e = e.return))
            } while (e)
            return t
          } catch (e) {
            return '\nError generating stack: ' + e.message + '\n' + e.stack
          }
        }
        function st(e) {
          switch (typeof e) {
            case 'bigint':
            case 'boolean':
            case 'number':
            case 'string':
            case 'undefined':
            case 'object':
              return e
            default:
              return ''
          }
        }
        function ut(e) {
          var t = e.type
          return (
            (e = e.nodeName) && 'input' === e.toLowerCase() && ('checkbox' === t || 'radio' === t)
          )
        }
        function ct(e) {
          e._valueTracker ||
            (e._valueTracker = (function (e) {
              var t = ut(e) ? 'checked' : 'value',
                n = Object.getOwnPropertyDescriptor(e.constructor.prototype, t),
                r = '' + e[t]
              if (
                !e.hasOwnProperty(t) &&
                void 0 !== n &&
                'function' == typeof n.get &&
                'function' == typeof n.set
              ) {
                var o = n.get,
                  a = n.set
                return (
                  Object.defineProperty(e, t, {
                    configurable: !0,
                    get: function () {
                      return o.call(this)
                    },
                    set: function (e) {
                      ;((r = '' + e), a.call(this, e))
                    },
                  }),
                  Object.defineProperty(e, t, { enumerable: n.enumerable }),
                  {
                    getValue: function () {
                      return r
                    },
                    setValue: function (e) {
                      r = '' + e
                    },
                    stopTracking: function () {
                      ;((e._valueTracker = null), delete e[t])
                    },
                  }
                )
              }
            })(e))
        }
        function dt(e) {
          if (!e) return !1
          var t = e._valueTracker
          if (!t) return !0
          var n = t.getValue(),
            r = ''
          return (
            e && (r = ut(e) ? (e.checked ? 'true' : 'false') : e.value),
            (e = r) !== n && (t.setValue(e), !0)
          )
        }
        function ft(e) {
          if (void 0 === (e = e || ('undefined' != typeof document ? document : void 0)))
            return null
          try {
            return e.activeElement || e.body
          } catch (t) {
            return e.body
          }
        }
        var pt = /[\n"\\]/g
        function mt(e) {
          return e.replace(pt, function (e) {
            return '\\' + e.charCodeAt(0).toString(16) + ' '
          })
        }
        function bt(e, t, n, r, o, a, l, i) {
          ;((e.name = ''),
            null != l && 'function' != typeof l && 'symbol' != typeof l && 'boolean' != typeof l
              ? (e.type = l)
              : e.removeAttribute('type'),
            null != t
              ? 'number' === l
                ? ((0 === t && '' === e.value) || e.value != t) && (e.value = '' + st(t))
                : e.value !== '' + st(t) && (e.value = '' + st(t))
              : ('submit' !== l && 'reset' !== l) || e.removeAttribute('value'),
            null != t
              ? gt(e, l, st(t))
              : null != n
                ? gt(e, l, st(n))
                : null != r && e.removeAttribute('value'),
            null == o && null != a && (e.defaultChecked = !!a),
            null != o && (e.checked = o && 'function' != typeof o && 'symbol' != typeof o),
            null != i && 'function' != typeof i && 'symbol' != typeof i && 'boolean' != typeof i
              ? (e.name = '' + st(i))
              : e.removeAttribute('name'))
        }
        function ht(e, t, n, r, o, a, l, i) {
          if (
            (null != a &&
              'function' != typeof a &&
              'symbol' != typeof a &&
              'boolean' != typeof a &&
              (e.type = a),
            null != t || null != n)
          ) {
            if (('submit' === a || 'reset' === a) && null == t) return
            ;((n = null != n ? '' + st(n) : ''),
              (t = null != t ? '' + st(t) : n),
              i || t === e.value || (e.value = t),
              (e.defaultValue = t))
          }
          ;((r = 'function' != typeof (r = null != r ? r : o) && 'symbol' != typeof r && !!r),
            (e.checked = i ? e.checked : !!r),
            (e.defaultChecked = !!r),
            null != l &&
              'function' != typeof l &&
              'symbol' != typeof l &&
              'boolean' != typeof l &&
              (e.name = l))
        }
        function gt(e, t, n) {
          ;('number' === t && ft(e.ownerDocument) === e) ||
            e.defaultValue === '' + n ||
            (e.defaultValue = '' + n)
        }
        function yt(e, t, n, r) {
          if (((e = e.options), t)) {
            t = {}
            for (var o = 0; o < n.length; o++) t['$' + n[o]] = !0
            for (n = 0; n < e.length; n++)
              ((o = t.hasOwnProperty('$' + e[n].value)),
                e[n].selected !== o && (e[n].selected = o),
                o && r && (e[n].defaultSelected = !0))
          } else {
            for (n = '' + st(n), t = null, o = 0; o < e.length; o++) {
              if (e[o].value === n)
                return ((e[o].selected = !0), void (r && (e[o].defaultSelected = !0)))
              null !== t || e[o].disabled || (t = e[o])
            }
            null !== t && (t.selected = !0)
          }
        }
        function vt(e, t, n) {
          null == t || ((t = '' + st(t)) !== e.value && (e.value = t), null != n)
            ? (e.defaultValue = null != n ? '' + st(n) : '')
            : e.defaultValue !== t && (e.defaultValue = t)
        }
        function St(e, t, n, r) {
          if (null == t) {
            if (null != r) {
              if (null != n) throw Error(l(92))
              if (N(r)) {
                if (1 < r.length) throw Error(l(93))
                r = r[0]
              }
              n = r
            }
            ;(null == n && (n = ''), (t = n))
          }
          ;((n = st(t)),
            (e.defaultValue = n),
            (r = e.textContent) === n && '' !== r && null !== r && (e.value = r))
        }
        function wt(e, t) {
          if (t) {
            var n = e.firstChild
            if (n && n === e.lastChild && 3 === n.nodeType) return void (n.nodeValue = t)
          }
          e.textContent = t
        }
        var Ot = new Set(
          'animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp'.split(
            ' '
          )
        )
        function kt(e, t, n) {
          var r = 0 === t.indexOf('--')
          null == n || 'boolean' == typeof n || '' === n
            ? r
              ? e.setProperty(t, '')
              : 'float' === t
                ? (e.cssFloat = '')
                : (e[t] = '')
            : r
              ? e.setProperty(t, n)
              : 'number' != typeof n || 0 === n || Ot.has(t)
                ? 'float' === t
                  ? (e.cssFloat = n)
                  : (e[t] = ('' + n).trim())
                : (e[t] = n + 'px')
        }
        function xt(e, t, n) {
          if (null != t && 'object' != typeof t) throw Error(l(62))
          if (((e = e.style), null != n)) {
            for (var r in n)
              !n.hasOwnProperty(r) ||
                (null != t && t.hasOwnProperty(r)) ||
                (0 === r.indexOf('--')
                  ? e.setProperty(r, '')
                  : 'float' === r
                    ? (e.cssFloat = '')
                    : (e[r] = ''))
            for (var o in t) ((r = t[o]), t.hasOwnProperty(o) && n[o] !== r && kt(e, o, r))
          } else for (var a in t) t.hasOwnProperty(a) && kt(e, a, t[a])
        }
        function Pt(e) {
          if (-1 === e.indexOf('-')) return !1
          switch (e) {
            case 'annotation-xml':
            case 'color-profile':
            case 'font-face':
            case 'font-face-src':
            case 'font-face-uri':
            case 'font-face-format':
            case 'font-face-name':
            case 'missing-glyph':
              return !1
            default:
              return !0
          }
        }
        var _t = new Map([
            ['acceptCharset', 'accept-charset'],
            ['htmlFor', 'for'],
            ['httpEquiv', 'http-equiv'],
            ['crossOrigin', 'crossorigin'],
            ['accentHeight', 'accent-height'],
            ['alignmentBaseline', 'alignment-baseline'],
            ['arabicForm', 'arabic-form'],
            ['baselineShift', 'baseline-shift'],
            ['capHeight', 'cap-height'],
            ['clipPath', 'clip-path'],
            ['clipRule', 'clip-rule'],
            ['colorInterpolation', 'color-interpolation'],
            ['colorInterpolationFilters', 'color-interpolation-filters'],
            ['colorProfile', 'color-profile'],
            ['colorRendering', 'color-rendering'],
            ['dominantBaseline', 'dominant-baseline'],
            ['enableBackground', 'enable-background'],
            ['fillOpacity', 'fill-opacity'],
            ['fillRule', 'fill-rule'],
            ['floodColor', 'flood-color'],
            ['floodOpacity', 'flood-opacity'],
            ['fontFamily', 'font-family'],
            ['fontSize', 'font-size'],
            ['fontSizeAdjust', 'font-size-adjust'],
            ['fontStretch', 'font-stretch'],
            ['fontStyle', 'font-style'],
            ['fontVariant', 'font-variant'],
            ['fontWeight', 'font-weight'],
            ['glyphName', 'glyph-name'],
            ['glyphOrientationHorizontal', 'glyph-orientation-horizontal'],
            ['glyphOrientationVertical', 'glyph-orientation-vertical'],
            ['horizAdvX', 'horiz-adv-x'],
            ['horizOriginX', 'horiz-origin-x'],
            ['imageRendering', 'image-rendering'],
            ['letterSpacing', 'letter-spacing'],
            ['lightingColor', 'lighting-color'],
            ['markerEnd', 'marker-end'],
            ['markerMid', 'marker-mid'],
            ['markerStart', 'marker-start'],
            ['overlinePosition', 'overline-position'],
            ['overlineThickness', 'overline-thickness'],
            ['paintOrder', 'paint-order'],
            ['panose-1', 'panose-1'],
            ['pointerEvents', 'pointer-events'],
            ['renderingIntent', 'rendering-intent'],
            ['shapeRendering', 'shape-rendering'],
            ['stopColor', 'stop-color'],
            ['stopOpacity', 'stop-opacity'],
            ['strikethroughPosition', 'strikethrough-position'],
            ['strikethroughThickness', 'strikethrough-thickness'],
            ['strokeDasharray', 'stroke-dasharray'],
            ['strokeDashoffset', 'stroke-dashoffset'],
            ['strokeLinecap', 'stroke-linecap'],
            ['strokeLinejoin', 'stroke-linejoin'],
            ['strokeMiterlimit', 'stroke-miterlimit'],
            ['strokeOpacity', 'stroke-opacity'],
            ['strokeWidth', 'stroke-width'],
            ['textAnchor', 'text-anchor'],
            ['textDecoration', 'text-decoration'],
            ['textRendering', 'text-rendering'],
            ['transformOrigin', 'transform-origin'],
            ['underlinePosition', 'underline-position'],
            ['underlineThickness', 'underline-thickness'],
            ['unicodeBidi', 'unicode-bidi'],
            ['unicodeRange', 'unicode-range'],
            ['unitsPerEm', 'units-per-em'],
            ['vAlphabetic', 'v-alphabetic'],
            ['vHanging', 'v-hanging'],
            ['vIdeographic', 'v-ideographic'],
            ['vMathematical', 'v-mathematical'],
            ['vectorEffect', 'vector-effect'],
            ['vertAdvY', 'vert-adv-y'],
            ['vertOriginX', 'vert-origin-x'],
            ['vertOriginY', 'vert-origin-y'],
            ['wordSpacing', 'word-spacing'],
            ['writingMode', 'writing-mode'],
            ['xmlnsXlink', 'xmlns:xlink'],
            ['xHeight', 'x-height'],
          ]),
          Ct =
            /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i
        function Et(e) {
          return Ct.test('' + e)
            ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"
            : e
        }
        var jt = null
        function Tt(e) {
          return (
            (e = e.target || e.srcElement || window).correspondingUseElement &&
              (e = e.correspondingUseElement),
            3 === e.nodeType ? e.parentNode : e
          )
        }
        var Rt = null,
          Nt = null
        function Mt(e) {
          var t = Ve(e)
          if (t && (e = t.stateNode)) {
            var n = e[Ne] || null
            e: switch (((e = t.stateNode), t.type)) {
              case 'input':
                if (
                  (bt(
                    e,
                    n.value,
                    n.defaultValue,
                    n.defaultValue,
                    n.checked,
                    n.defaultChecked,
                    n.type,
                    n.name
                  ),
                  (t = n.name),
                  'radio' === n.type && null != t)
                ) {
                  for (n = e; n.parentNode; ) n = n.parentNode
                  for (
                    n = n.querySelectorAll('input[name="' + mt('' + t) + '"][type="radio"]'), t = 0;
                    t < n.length;
                    t++
                  ) {
                    var r = n[t]
                    if (r !== e && r.form === e.form) {
                      var o = r[Ne] || null
                      if (!o) throw Error(l(90))
                      bt(
                        r,
                        o.value,
                        o.defaultValue,
                        o.defaultValue,
                        o.checked,
                        o.defaultChecked,
                        o.type,
                        o.name
                      )
                    }
                  }
                  for (t = 0; t < n.length; t++) (r = n[t]).form === e.form && dt(r)
                }
                break e
              case 'textarea':
                vt(e, n.value, n.defaultValue)
                break e
              case 'select':
                null != (t = n.value) && yt(e, !!n.multiple, t, !1)
            }
          }
        }
        var At = !1
        function Dt(e, t, n) {
          if (At) return e(t, n)
          At = !0
          try {
            return e(t)
          } finally {
            if (
              ((At = !1),
              (null !== Rt || null !== Nt) &&
                (Fu(), Rt && ((t = Rt), (e = Nt), (Nt = Rt = null), Mt(t), e)))
            )
              for (t = 0; t < e.length; t++) Mt(e[t])
          }
        }
        function zt(e, t) {
          var n = e.stateNode
          if (null === n) return null
          var r = n[Ne] || null
          if (null === r) return null
          n = r[t]
          e: switch (t) {
            case 'onClick':
            case 'onClickCapture':
            case 'onDoubleClick':
            case 'onDoubleClickCapture':
            case 'onMouseDown':
            case 'onMouseDownCapture':
            case 'onMouseMove':
            case 'onMouseMoveCapture':
            case 'onMouseUp':
            case 'onMouseUpCapture':
            case 'onMouseEnter':
              ;((r = !r.disabled) ||
                (r = !(
                  'button' === (e = e.type) ||
                  'input' === e ||
                  'select' === e ||
                  'textarea' === e
                )),
                (e = !r))
              break e
            default:
              e = !1
          }
          if (e) return null
          if (n && 'function' != typeof n) throw Error(l(231, t, typeof n))
          return n
        }
        var It = !(
            'undefined' == typeof window ||
            void 0 === window.document ||
            void 0 === window.document.createElement
          ),
          $t = !1
        if (It)
          try {
            var Lt = {}
            ;(Object.defineProperty(Lt, 'passive', {
              get: function () {
                $t = !0
              },
            }),
              window.addEventListener('test', Lt, Lt),
              window.removeEventListener('test', Lt, Lt))
          } catch (e) {
            $t = !1
          }
        var Ft = null,
          Vt = null,
          Wt = null
        function Bt() {
          if (Wt) return Wt
          var e,
            t,
            n = Vt,
            r = n.length,
            o = 'value' in Ft ? Ft.value : Ft.textContent,
            a = o.length
          for (e = 0; e < r && n[e] === o[e]; e++);
          var l = r - e
          for (t = 1; t <= l && n[r - t] === o[a - t]; t++);
          return (Wt = o.slice(e, 1 < t ? 1 - t : void 0))
        }
        function Ht(e) {
          var t = e.keyCode
          return (
            'charCode' in e ? 0 === (e = e.charCode) && 13 === t && (e = 13) : (e = t),
            10 === e && (e = 13),
            32 <= e || 13 === e ? e : 0
          )
        }
        function Ut() {
          return !0
        }
        function Gt() {
          return !1
        }
        function qt(e) {
          function t(t, n, r, o, a) {
            for (var l in ((this._reactName = t),
            (this._targetInst = r),
            (this.type = n),
            (this.nativeEvent = o),
            (this.target = a),
            (this.currentTarget = null),
            e))
              e.hasOwnProperty(l) && ((t = e[l]), (this[l] = t ? t(o) : o[l]))
            return (
              (this.isDefaultPrevented = (
                null != o.defaultPrevented ? o.defaultPrevented : !1 === o.returnValue
              )
                ? Ut
                : Gt),
              (this.isPropagationStopped = Gt),
              this
            )
          }
          return (
            d(t.prototype, {
              preventDefault: function () {
                this.defaultPrevented = !0
                var e = this.nativeEvent
                e &&
                  (e.preventDefault
                    ? e.preventDefault()
                    : 'unknown' != typeof e.returnValue && (e.returnValue = !1),
                  (this.isDefaultPrevented = Ut))
              },
              stopPropagation: function () {
                var e = this.nativeEvent
                e &&
                  (e.stopPropagation
                    ? e.stopPropagation()
                    : 'unknown' != typeof e.cancelBubble && (e.cancelBubble = !0),
                  (this.isPropagationStopped = Ut))
              },
              persist: function () {},
              isPersistent: Ut,
            }),
            t
          )
        }
        var Xt,
          Yt,
          Kt,
          Qt = {
            eventPhase: 0,
            bubbles: 0,
            cancelable: 0,
            timeStamp: function (e) {
              return e.timeStamp || Date.now()
            },
            defaultPrevented: 0,
            isTrusted: 0,
          },
          Zt = qt(Qt),
          Jt = d({}, Qt, { view: 0, detail: 0 }),
          en = qt(Jt),
          tn = d({}, Jt, {
            screenX: 0,
            screenY: 0,
            clientX: 0,
            clientY: 0,
            pageX: 0,
            pageY: 0,
            ctrlKey: 0,
            shiftKey: 0,
            altKey: 0,
            metaKey: 0,
            getModifierState: pn,
            button: 0,
            buttons: 0,
            relatedTarget: function (e) {
              return void 0 === e.relatedTarget
                ? e.fromElement === e.srcElement
                  ? e.toElement
                  : e.fromElement
                : e.relatedTarget
            },
            movementX: function (e) {
              return 'movementX' in e
                ? e.movementX
                : (e !== Kt &&
                    (Kt && 'mousemove' === e.type
                      ? ((Xt = e.screenX - Kt.screenX), (Yt = e.screenY - Kt.screenY))
                      : (Yt = Xt = 0),
                    (Kt = e)),
                  Xt)
            },
            movementY: function (e) {
              return 'movementY' in e ? e.movementY : Yt
            },
          }),
          nn = qt(tn),
          rn = qt(d({}, tn, { dataTransfer: 0 })),
          on = qt(d({}, Jt, { relatedTarget: 0 })),
          an = qt(d({}, Qt, { animationName: 0, elapsedTime: 0, pseudoElement: 0 })),
          ln = qt(
            d({}, Qt, {
              clipboardData: function (e) {
                return 'clipboardData' in e ? e.clipboardData : window.clipboardData
              },
            })
          ),
          sn = qt(d({}, Qt, { data: 0 })),
          un = {
            Esc: 'Escape',
            Spacebar: ' ',
            Left: 'ArrowLeft',
            Up: 'ArrowUp',
            Right: 'ArrowRight',
            Down: 'ArrowDown',
            Del: 'Delete',
            Win: 'OS',
            Menu: 'ContextMenu',
            Apps: 'ContextMenu',
            Scroll: 'ScrollLock',
            MozPrintableKey: 'Unidentified',
          },
          cn = {
            8: 'Backspace',
            9: 'Tab',
            12: 'Clear',
            13: 'Enter',
            16: 'Shift',
            17: 'Control',
            18: 'Alt',
            19: 'Pause',
            20: 'CapsLock',
            27: 'Escape',
            32: ' ',
            33: 'PageUp',
            34: 'PageDown',
            35: 'End',
            36: 'Home',
            37: 'ArrowLeft',
            38: 'ArrowUp',
            39: 'ArrowRight',
            40: 'ArrowDown',
            45: 'Insert',
            46: 'Delete',
            112: 'F1',
            113: 'F2',
            114: 'F3',
            115: 'F4',
            116: 'F5',
            117: 'F6',
            118: 'F7',
            119: 'F8',
            120: 'F9',
            121: 'F10',
            122: 'F11',
            123: 'F12',
            144: 'NumLock',
            145: 'ScrollLock',
            224: 'Meta',
          },
          dn = { Alt: 'altKey', Control: 'ctrlKey', Meta: 'metaKey', Shift: 'shiftKey' }
        function fn(e) {
          var t = this.nativeEvent
          return t.getModifierState ? t.getModifierState(e) : !!(e = dn[e]) && !!t[e]
        }
        function pn() {
          return fn
        }
        var mn = qt(
            d({}, Jt, {
              key: function (e) {
                if (e.key) {
                  var t = un[e.key] || e.key
                  if ('Unidentified' !== t) return t
                }
                return 'keypress' === e.type
                  ? 13 === (e = Ht(e))
                    ? 'Enter'
                    : String.fromCharCode(e)
                  : 'keydown' === e.type || 'keyup' === e.type
                    ? cn[e.keyCode] || 'Unidentified'
                    : ''
              },
              code: 0,
              location: 0,
              ctrlKey: 0,
              shiftKey: 0,
              altKey: 0,
              metaKey: 0,
              repeat: 0,
              locale: 0,
              getModifierState: pn,
              charCode: function (e) {
                return 'keypress' === e.type ? Ht(e) : 0
              },
              keyCode: function (e) {
                return 'keydown' === e.type || 'keyup' === e.type ? e.keyCode : 0
              },
              which: function (e) {
                return 'keypress' === e.type
                  ? Ht(e)
                  : 'keydown' === e.type || 'keyup' === e.type
                    ? e.keyCode
                    : 0
              },
            })
          ),
          bn = qt(
            d({}, tn, {
              pointerId: 0,
              width: 0,
              height: 0,
              pressure: 0,
              tangentialPressure: 0,
              tiltX: 0,
              tiltY: 0,
              twist: 0,
              pointerType: 0,
              isPrimary: 0,
            })
          ),
          hn = qt(
            d({}, Jt, {
              touches: 0,
              targetTouches: 0,
              changedTouches: 0,
              altKey: 0,
              metaKey: 0,
              ctrlKey: 0,
              shiftKey: 0,
              getModifierState: pn,
            })
          ),
          gn = qt(d({}, Qt, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 })),
          yn = qt(
            d({}, tn, {
              deltaX: function (e) {
                return 'deltaX' in e ? e.deltaX : 'wheelDeltaX' in e ? -e.wheelDeltaX : 0
              },
              deltaY: function (e) {
                return 'deltaY' in e
                  ? e.deltaY
                  : 'wheelDeltaY' in e
                    ? -e.wheelDeltaY
                    : 'wheelDelta' in e
                      ? -e.wheelDelta
                      : 0
              },
              deltaZ: 0,
              deltaMode: 0,
            })
          ),
          vn = qt(d({}, Qt, { newState: 0, oldState: 0 })),
          Sn = [9, 13, 27, 32],
          wn = It && 'CompositionEvent' in window,
          On = null
        It && 'documentMode' in document && (On = document.documentMode)
        var kn = It && 'TextEvent' in window && !On,
          xn = It && (!wn || (On && 8 < On && 11 >= On)),
          Pn = String.fromCharCode(32),
          _n = !1
        function Cn(e, t) {
          switch (e) {
            case 'keyup':
              return -1 !== Sn.indexOf(t.keyCode)
            case 'keydown':
              return 229 !== t.keyCode
            case 'keypress':
            case 'mousedown':
            case 'focusout':
              return !0
            default:
              return !1
          }
        }
        function En(e) {
          return 'object' == typeof (e = e.detail) && 'data' in e ? e.data : null
        }
        var jn = !1,
          Tn = {
            color: !0,
            date: !0,
            datetime: !0,
            'datetime-local': !0,
            email: !0,
            month: !0,
            number: !0,
            password: !0,
            range: !0,
            search: !0,
            tel: !0,
            text: !0,
            time: !0,
            url: !0,
            week: !0,
          }
        function Rn(e) {
          var t = e && e.nodeName && e.nodeName.toLowerCase()
          return 'input' === t ? !!Tn[e.type] : 'textarea' === t
        }
        function Nn(e, t, n, r) {
          ;(Rt ? (Nt ? Nt.push(r) : (Nt = [r])) : (Rt = r),
            0 < (t = Bc(t, 'onChange')).length &&
              ((n = new Zt('onChange', 'change', null, n, r)), e.push({ event: n, listeners: t })))
        }
        var Mn = null,
          An = null
        function Dn(e) {
          Dc(e, 0)
        }
        function zn(e) {
          if (dt(We(e))) return e
        }
        function In(e, t) {
          if ('change' === e) return t
        }
        var $n = !1
        if (It) {
          var Ln
          if (It) {
            var Fn = 'oninput' in document
            if (!Fn) {
              var Vn = document.createElement('div')
              ;(Vn.setAttribute('oninput', 'return;'), (Fn = 'function' == typeof Vn.oninput))
            }
            Ln = Fn
          } else Ln = !1
          $n = Ln && (!document.documentMode || 9 < document.documentMode)
        }
        function Wn() {
          Mn && (Mn.detachEvent('onpropertychange', Bn), (An = Mn = null))
        }
        function Bn(e) {
          if ('value' === e.propertyName && zn(An)) {
            var t = []
            ;(Nn(t, An, e, Tt(e)), Dt(Dn, t))
          }
        }
        function Hn(e, t, n) {
          'focusin' === e
            ? (Wn(), (An = n), (Mn = t).attachEvent('onpropertychange', Bn))
            : 'focusout' === e && Wn()
        }
        function Un(e) {
          if ('selectionchange' === e || 'keyup' === e || 'keydown' === e) return zn(An)
        }
        function Gn(e, t) {
          if ('click' === e) return zn(t)
        }
        function qn(e, t) {
          if ('input' === e || 'change' === e) return zn(t)
        }
        var Xn =
          'function' == typeof Object.is
            ? Object.is
            : function (e, t) {
                return (e === t && (0 !== e || 1 / e == 1 / t)) || (e != e && t != t)
              }
        function Yn(e, t) {
          if (Xn(e, t)) return !0
          if ('object' != typeof e || null === e || 'object' != typeof t || null === t) return !1
          var n = Object.keys(e),
            r = Object.keys(t)
          if (n.length !== r.length) return !1
          for (r = 0; r < n.length; r++) {
            var o = n[r]
            if (!Y.call(t, o) || !Xn(e[o], t[o])) return !1
          }
          return !0
        }
        function Kn(e) {
          for (; e && e.firstChild; ) e = e.firstChild
          return e
        }
        function Qn(e, t) {
          var n,
            r = Kn(e)
          for (e = 0; r; ) {
            if (3 === r.nodeType) {
              if (((n = e + r.textContent.length), e <= t && n >= t))
                return { node: r, offset: t - e }
              e = n
            }
            e: {
              for (; r; ) {
                if (r.nextSibling) {
                  r = r.nextSibling
                  break e
                }
                r = r.parentNode
              }
              r = void 0
            }
            r = Kn(r)
          }
        }
        function Zn(e, t) {
          return (
            !(!e || !t) &&
            (e === t ||
              ((!e || 3 !== e.nodeType) &&
                (t && 3 === t.nodeType
                  ? Zn(e, t.parentNode)
                  : 'contains' in e
                    ? e.contains(t)
                    : !!e.compareDocumentPosition && !!(16 & e.compareDocumentPosition(t)))))
          )
        }
        function Jn(e) {
          for (
            var t = ft(
              (e =
                null != e && null != e.ownerDocument && null != e.ownerDocument.defaultView
                  ? e.ownerDocument.defaultView
                  : window).document
            );
            t instanceof e.HTMLIFrameElement;

          ) {
            try {
              var n = 'string' == typeof t.contentWindow.location.href
            } catch (e) {
              n = !1
            }
            if (!n) break
            t = ft((e = t.contentWindow).document)
          }
          return t
        }
        function er(e) {
          var t = e && e.nodeName && e.nodeName.toLowerCase()
          return (
            t &&
            (('input' === t &&
              ('text' === e.type ||
                'search' === e.type ||
                'tel' === e.type ||
                'url' === e.type ||
                'password' === e.type)) ||
              'textarea' === t ||
              'true' === e.contentEditable)
          )
        }
        var tr = It && 'documentMode' in document && 11 >= document.documentMode,
          nr = null,
          rr = null,
          or = null,
          ar = !1
        function lr(e, t, n) {
          var r = n.window === n ? n.document : 9 === n.nodeType ? n : n.ownerDocument
          ar ||
            null == nr ||
            nr !== ft(r) ||
            ((r =
              'selectionStart' in (r = nr) && er(r)
                ? { start: r.selectionStart, end: r.selectionEnd }
                : {
                    anchorNode: (r = (
                      (r.ownerDocument && r.ownerDocument.defaultView) ||
                      window
                    ).getSelection()).anchorNode,
                    anchorOffset: r.anchorOffset,
                    focusNode: r.focusNode,
                    focusOffset: r.focusOffset,
                  }),
            (or && Yn(or, r)) ||
              ((or = r),
              0 < (r = Bc(rr, 'onSelect')).length &&
                ((t = new Zt('onSelect', 'select', null, t, n)),
                e.push({ event: t, listeners: r }),
                (t.target = nr))))
        }
        function ir(e, t) {
          var n = {}
          return (
            (n[e.toLowerCase()] = t.toLowerCase()),
            (n['Webkit' + e] = 'webkit' + t),
            (n['Moz' + e] = 'moz' + t),
            n
          )
        }
        var sr = {
            animationend: ir('Animation', 'AnimationEnd'),
            animationiteration: ir('Animation', 'AnimationIteration'),
            animationstart: ir('Animation', 'AnimationStart'),
            transitionrun: ir('Transition', 'TransitionRun'),
            transitionstart: ir('Transition', 'TransitionStart'),
            transitioncancel: ir('Transition', 'TransitionCancel'),
            transitionend: ir('Transition', 'TransitionEnd'),
          },
          ur = {},
          cr = {}
        function dr(e) {
          if (ur[e]) return ur[e]
          if (!sr[e]) return e
          var t,
            n = sr[e]
          for (t in n) if (n.hasOwnProperty(t) && t in cr) return (ur[e] = n[t])
          return e
        }
        It &&
          ((cr = document.createElement('div').style),
          'AnimationEvent' in window ||
            (delete sr.animationend.animation,
            delete sr.animationiteration.animation,
            delete sr.animationstart.animation),
          'TransitionEvent' in window || delete sr.transitionend.transition)
        var fr = dr('animationend'),
          pr = dr('animationiteration'),
          mr = dr('animationstart'),
          br = dr('transitionrun'),
          hr = dr('transitionstart'),
          gr = dr('transitioncancel'),
          yr = dr('transitionend'),
          vr = new Map(),
          Sr =
            'abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel'.split(
              ' '
            )
        function wr(e, t) {
          ;(vr.set(e, t), qe(t, [e]))
        }
        Sr.push('scrollEnd')
        var Or = new WeakMap()
        function kr(e, t) {
          if ('object' == typeof e && null !== e) {
            var n = Or.get(e)
            return void 0 !== n ? n : ((t = { value: e, source: t, stack: it(t) }), Or.set(e, t), t)
          }
          return { value: e, source: t, stack: it(t) }
        }
        var xr = [],
          Pr = 0,
          _r = 0
        function Cr() {
          for (var e = Pr, t = (_r = Pr = 0); t < e; ) {
            var n = xr[t]
            xr[t++] = null
            var r = xr[t]
            xr[t++] = null
            var o = xr[t]
            xr[t++] = null
            var a = xr[t]
            if (((xr[t++] = null), null !== r && null !== o)) {
              var l = r.pending
              ;(null === l ? (o.next = o) : ((o.next = l.next), (l.next = o)), (r.pending = o))
            }
            0 !== a && Rr(n, o, a)
          }
        }
        function Er(e, t, n, r) {
          ;((xr[Pr++] = e),
            (xr[Pr++] = t),
            (xr[Pr++] = n),
            (xr[Pr++] = r),
            (_r |= r),
            (e.lanes |= r),
            null !== (e = e.alternate) && (e.lanes |= r))
        }
        function jr(e, t, n, r) {
          return (Er(e, t, n, r), Nr(e))
        }
        function Tr(e, t) {
          return (Er(e, null, null, t), Nr(e))
        }
        function Rr(e, t, n) {
          e.lanes |= n
          var r = e.alternate
          null !== r && (r.lanes |= n)
          for (var o = !1, a = e.return; null !== a; )
            ((a.childLanes |= n),
              null !== (r = a.alternate) && (r.childLanes |= n),
              22 === a.tag && (null === (e = a.stateNode) || 1 & e._visibility || (o = !0)),
              (e = a),
              (a = a.return))
          return 3 === e.tag
            ? ((a = e.stateNode),
              o &&
                null !== t &&
                ((o = 31 - fe(n)),
                null === (r = (e = a.hiddenUpdates)[o]) ? (e[o] = [t]) : r.push(t),
                (t.lane = 536870912 | n)),
              a)
            : null
        }
        function Nr(e) {
          if (50 < Ru) throw ((Ru = 0), (Nu = null), Error(l(185)))
          for (var t = e.return; null !== t; ) t = (e = t).return
          return 3 === e.tag ? e.stateNode : null
        }
        var Mr = {}
        function Ar(e, t, n, r) {
          ;((this.tag = e),
            (this.key = n),
            (this.sibling =
              this.child =
              this.return =
              this.stateNode =
              this.type =
              this.elementType =
                null),
            (this.index = 0),
            (this.refCleanup = this.ref = null),
            (this.pendingProps = t),
            (this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null),
            (this.mode = r),
            (this.subtreeFlags = this.flags = 0),
            (this.deletions = null),
            (this.childLanes = this.lanes = 0),
            (this.alternate = null))
        }
        function Dr(e, t, n, r) {
          return new Ar(e, t, n, r)
        }
        function zr(e) {
          return !(!(e = e.prototype) || !e.isReactComponent)
        }
        function Ir(e, t) {
          var n = e.alternate
          return (
            null === n
              ? (((n = Dr(e.tag, t, e.key, e.mode)).elementType = e.elementType),
                (n.type = e.type),
                (n.stateNode = e.stateNode),
                (n.alternate = e),
                (e.alternate = n))
              : ((n.pendingProps = t),
                (n.type = e.type),
                (n.flags = 0),
                (n.subtreeFlags = 0),
                (n.deletions = null)),
            (n.flags = 65011712 & e.flags),
            (n.childLanes = e.childLanes),
            (n.lanes = e.lanes),
            (n.child = e.child),
            (n.memoizedProps = e.memoizedProps),
            (n.memoizedState = e.memoizedState),
            (n.updateQueue = e.updateQueue),
            (t = e.dependencies),
            (n.dependencies = null === t ? null : { lanes: t.lanes, firstContext: t.firstContext }),
            (n.sibling = e.sibling),
            (n.index = e.index),
            (n.ref = e.ref),
            (n.refCleanup = e.refCleanup),
            n
          )
        }
        function $r(e, t) {
          e.flags &= 65011714
          var n = e.alternate
          return (
            null === n
              ? ((e.childLanes = 0),
                (e.lanes = t),
                (e.child = null),
                (e.subtreeFlags = 0),
                (e.memoizedProps = null),
                (e.memoizedState = null),
                (e.updateQueue = null),
                (e.dependencies = null),
                (e.stateNode = null))
              : ((e.childLanes = n.childLanes),
                (e.lanes = n.lanes),
                (e.child = n.child),
                (e.subtreeFlags = 0),
                (e.deletions = null),
                (e.memoizedProps = n.memoizedProps),
                (e.memoizedState = n.memoizedState),
                (e.updateQueue = n.updateQueue),
                (e.type = n.type),
                (t = n.dependencies),
                (e.dependencies =
                  null === t ? null : { lanes: t.lanes, firstContext: t.firstContext })),
            e
          )
        }
        function Lr(e, t, n, r, o, a) {
          var i = 0
          if (((r = e), 'function' == typeof e)) zr(e) && (i = 1)
          else if ('string' == typeof e)
            i = (function (e, t, n) {
              if (1 === n || null != t.itemProp) return !1
              switch (e) {
                case 'meta':
                case 'title':
                  return !0
                case 'style':
                  if ('string' != typeof t.precedence || 'string' != typeof t.href || '' === t.href)
                    break
                  return !0
                case 'link':
                  if (
                    'string' != typeof t.rel ||
                    'string' != typeof t.href ||
                    '' === t.href ||
                    t.onLoad ||
                    t.onError
                  )
                    break
                  return (
                    'stylesheet' !== t.rel ||
                    ((e = t.disabled), 'string' == typeof t.precedence && null == e)
                  )
                case 'script':
                  if (
                    t.async &&
                    'function' != typeof t.async &&
                    'symbol' != typeof t.async &&
                    !t.onLoad &&
                    !t.onError &&
                    t.src &&
                    'string' == typeof t.src
                  )
                    return !0
              }
              return !1
            })(e, n, V.current)
              ? 26
              : 'html' === e || 'head' === e || 'body' === e
                ? 27
                : 5
          else
            e: switch (e) {
              case _:
                return (((e = Dr(31, n, t, o)).elementType = _), (e.lanes = a), e)
              case b:
                return Fr(n.children, o, a, t)
              case h:
                ;((i = 8), (o |= 24))
                break
              case g:
                return (((e = Dr(12, n, t, 2 | o)).elementType = g), (e.lanes = a), e)
              case O:
                return (((e = Dr(13, n, t, o)).elementType = O), (e.lanes = a), e)
              case k:
                return (((e = Dr(19, n, t, o)).elementType = k), (e.lanes = a), e)
              default:
                if ('object' == typeof e && null !== e)
                  switch (e.$$typeof) {
                    case y:
                    case S:
                      i = 10
                      break e
                    case v:
                      i = 9
                      break e
                    case w:
                      i = 11
                      break e
                    case x:
                      i = 14
                      break e
                    case P:
                      ;((i = 16), (r = null))
                      break e
                  }
                ;((i = 29), (n = Error(l(130, null === e ? 'null' : typeof e, ''))), (r = null))
            }
          return (((t = Dr(i, n, t, o)).elementType = e), (t.type = r), (t.lanes = a), t)
        }
        function Fr(e, t, n, r) {
          return (((e = Dr(7, e, r, t)).lanes = n), e)
        }
        function Vr(e, t, n) {
          return (((e = Dr(6, e, null, t)).lanes = n), e)
        }
        function Wr(e, t, n) {
          return (
            ((t = Dr(4, null !== e.children ? e.children : [], e.key, t)).lanes = n),
            (t.stateNode = {
              containerInfo: e.containerInfo,
              pendingChildren: null,
              implementation: e.implementation,
            }),
            t
          )
        }
        var Br = [],
          Hr = 0,
          Ur = null,
          Gr = 0,
          qr = [],
          Xr = 0,
          Yr = null,
          Kr = 1,
          Qr = ''
        function Zr(e, t) {
          ;((Br[Hr++] = Gr), (Br[Hr++] = Ur), (Ur = e), (Gr = t))
        }
        function Jr(e, t, n) {
          ;((qr[Xr++] = Kr), (qr[Xr++] = Qr), (qr[Xr++] = Yr), (Yr = e))
          var r = Kr
          e = Qr
          var o = 32 - fe(r) - 1
          ;((r &= ~(1 << o)), (n += 1))
          var a = 32 - fe(t) + o
          if (30 < a) {
            var l = o - (o % 5)
            ;((a = (r & ((1 << l) - 1)).toString(32)),
              (r >>= l),
              (o -= l),
              (Kr = (1 << (32 - fe(t) + o)) | (n << o) | r),
              (Qr = a + e))
          } else ((Kr = (1 << a) | (n << o) | r), (Qr = e))
        }
        function eo(e) {
          null !== e.return && (Zr(e, 1), Jr(e, 1, 0))
        }
        function to(e) {
          for (; e === Ur; ) ((Ur = Br[--Hr]), (Br[Hr] = null), (Gr = Br[--Hr]), (Br[Hr] = null))
          for (; e === Yr; )
            ((Yr = qr[--Xr]),
              (qr[Xr] = null),
              (Qr = qr[--Xr]),
              (qr[Xr] = null),
              (Kr = qr[--Xr]),
              (qr[Xr] = null))
        }
        var no = null,
          ro = null,
          oo = !1,
          ao = null,
          lo = !1,
          io = Error(l(519))
        function so(e) {
          throw (bo(kr(Error(l(418, '')), e)), io)
        }
        function uo(e) {
          var t = e.stateNode,
            n = e.type,
            r = e.memoizedProps
          switch (((t[Re] = e), (t[Ne] = r), n)) {
            case 'dialog':
              ;(zc('cancel', t), zc('close', t))
              break
            case 'iframe':
            case 'object':
            case 'embed':
              zc('load', t)
              break
            case 'video':
            case 'audio':
              for (n = 0; n < Mc.length; n++) zc(Mc[n], t)
              break
            case 'source':
              zc('error', t)
              break
            case 'img':
            case 'image':
            case 'link':
              ;(zc('error', t), zc('load', t))
              break
            case 'details':
              zc('toggle', t)
              break
            case 'input':
              ;(zc('invalid', t),
                ht(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0),
                ct(t))
              break
            case 'select':
              zc('invalid', t)
              break
            case 'textarea':
              ;(zc('invalid', t), St(t, r.value, r.defaultValue, r.children), ct(t))
          }
          ;(('string' != typeof (n = r.children) && 'number' != typeof n && 'bigint' != typeof n) ||
          t.textContent === '' + n ||
          !0 === r.suppressHydrationWarning ||
          Yc(t.textContent, n)
            ? (null != r.popover && (zc('beforetoggle', t), zc('toggle', t)),
              null != r.onScroll && zc('scroll', t),
              null != r.onScrollEnd && zc('scrollend', t),
              null != r.onClick && (t.onclick = Kc),
              (t = !0))
            : (t = !1),
            t || so(e))
        }
        function co(e) {
          for (no = e.return; no; )
            switch (no.tag) {
              case 5:
              case 13:
                return void (lo = !1)
              case 27:
              case 3:
                return void (lo = !0)
              default:
                no = no.return
            }
        }
        function fo(e) {
          if (e !== no) return !1
          if (!oo) return (co(e), (oo = !0), !1)
          var t,
            n = e.tag
          if (
            ((t = 3 !== n && 27 !== n) &&
              ((t = 5 === n) &&
                (t = !('form' !== (t = e.type) && 'button' !== t) || ad(e.type, e.memoizedProps)),
              (t = !t)),
            t && ro && so(e),
            co(e),
            13 === n)
          ) {
            if (!(e = null !== (e = e.memoizedState) ? e.dehydrated : null)) throw Error(l(317))
            e: {
              for (e = e.nextSibling, n = 0; e; ) {
                if (8 === e.nodeType)
                  if ('/$' === (t = e.data)) {
                    if (0 === n) {
                      ro = hd(e.nextSibling)
                      break e
                    }
                    n--
                  } else ('$' !== t && '$!' !== t && '$?' !== t) || n++
                e = e.nextSibling
              }
              ro = null
            }
          } else
            27 === n
              ? ((n = ro), fd(e.type) ? ((e = gd), (gd = null), (ro = e)) : (ro = n))
              : (ro = no ? hd(e.stateNode.nextSibling) : null)
          return !0
        }
        function po() {
          ;((ro = no = null), (oo = !1))
        }
        function mo() {
          var e = ao
          return (null !== e && (null === yu ? (yu = e) : yu.push.apply(yu, e), (ao = null)), e)
        }
        function bo(e) {
          null === ao ? (ao = [e]) : ao.push(e)
        }
        var ho = $(null),
          go = null,
          yo = null
        function vo(e, t, n) {
          ;(F(ho, t._currentValue), (t._currentValue = n))
        }
        function So(e) {
          ;((e._currentValue = ho.current), L(ho))
        }
        function wo(e, t, n) {
          for (; null !== e; ) {
            var r = e.alternate
            if (
              ((e.childLanes & t) !== t
                ? ((e.childLanes |= t), null !== r && (r.childLanes |= t))
                : null !== r && (r.childLanes & t) !== t && (r.childLanes |= t),
              e === n)
            )
              break
            e = e.return
          }
        }
        function Oo(e, t, n, r) {
          var o = e.child
          for (null !== o && (o.return = e); null !== o; ) {
            var a = o.dependencies
            if (null !== a) {
              var i = o.child
              a = a.firstContext
              e: for (; null !== a; ) {
                var s = a
                a = o
                for (var u = 0; u < t.length; u++)
                  if (s.context === t[u]) {
                    ;((a.lanes |= n),
                      null !== (s = a.alternate) && (s.lanes |= n),
                      wo(a.return, n, e),
                      r || (i = null))
                    break e
                  }
                a = s.next
              }
            } else if (18 === o.tag) {
              if (null === (i = o.return)) throw Error(l(341))
              ;((i.lanes |= n),
                null !== (a = i.alternate) && (a.lanes |= n),
                wo(i, n, e),
                (i = null))
            } else i = o.child
            if (null !== i) i.return = o
            else
              for (i = o; null !== i; ) {
                if (i === e) {
                  i = null
                  break
                }
                if (null !== (o = i.sibling)) {
                  ;((o.return = i.return), (i = o))
                  break
                }
                i = i.return
              }
            o = i
          }
        }
        function ko(e, t, n, r) {
          e = null
          for (var o = t, a = !1; null !== o; ) {
            if (!a)
              if (524288 & o.flags) a = !0
              else if (262144 & o.flags) break
            if (10 === o.tag) {
              var i = o.alternate
              if (null === i) throw Error(l(387))
              if (null !== (i = i.memoizedProps)) {
                var s = o.type
                Xn(o.pendingProps.value, i.value) || (null !== e ? e.push(s) : (e = [s]))
              }
            } else if (o === H.current) {
              if (null === (i = o.alternate)) throw Error(l(387))
              i.memoizedState.memoizedState !== o.memoizedState.memoizedState &&
                (null !== e ? e.push(qd) : (e = [qd]))
            }
            o = o.return
          }
          ;(null !== e && Oo(t, e, n, r), (t.flags |= 262144))
        }
        function xo(e) {
          for (e = e.firstContext; null !== e; ) {
            if (!Xn(e.context._currentValue, e.memoizedValue)) return !0
            e = e.next
          }
          return !1
        }
        function Po(e) {
          ;((go = e), (yo = null), null !== (e = e.dependencies) && (e.firstContext = null))
        }
        function _o(e) {
          return Eo(go, e)
        }
        function Co(e, t) {
          return (null === go && Po(e), Eo(e, t))
        }
        function Eo(e, t) {
          var n = t._currentValue
          if (((t = { context: t, memoizedValue: n, next: null }), null === yo)) {
            if (null === e) throw Error(l(308))
            ;((yo = t), (e.dependencies = { lanes: 0, firstContext: t }), (e.flags |= 524288))
          } else yo = yo.next = t
          return n
        }
        var jo =
            'undefined' != typeof AbortController
              ? AbortController
              : function () {
                  var e = [],
                    t = (this.signal = {
                      aborted: !1,
                      addEventListener: function (t, n) {
                        e.push(n)
                      },
                    })
                  this.abort = function () {
                    ;((t.aborted = !0),
                      e.forEach(function (e) {
                        return e()
                      }))
                  }
                },
          To = r.unstable_scheduleCallback,
          Ro = r.unstable_NormalPriority,
          No = {
            $$typeof: S,
            Consumer: null,
            Provider: null,
            _currentValue: null,
            _currentValue2: null,
            _threadCount: 0,
          }
        function Mo() {
          return { controller: new jo(), data: new Map(), refCount: 0 }
        }
        function Ao(e) {
          ;(e.refCount--,
            0 === e.refCount &&
              To(Ro, function () {
                e.controller.abort()
              }))
        }
        var Do = null,
          zo = 0,
          Io = 0,
          $o = null
        function Lo() {
          if (0 == --zo && null !== Do) {
            null !== $o && ($o.status = 'fulfilled')
            var e = Do
            ;((Do = null), (Io = 0), ($o = null))
            for (var t = 0; t < e.length; t++) (0, e[t])()
          }
        }
        var Fo = M.S
        M.S = function (e, t) {
          ;('object' == typeof t &&
            null !== t &&
            'function' == typeof t.then &&
            (function (e, t) {
              if (null === Do) {
                var n = (Do = [])
                ;((zo = 0),
                  (Io = Ec()),
                  ($o = {
                    status: 'pending',
                    value: void 0,
                    then: function (e) {
                      n.push(e)
                    },
                  }))
              }
              ;(zo++, t.then(Lo, Lo))
            })(0, t),
            null !== Fo && Fo(e, t))
        }
        var Vo = $(null)
        function Wo() {
          var e = Vo.current
          return null !== e ? e : nu.pooledCache
        }
        function Bo(e, t) {
          F(Vo, null === t ? Vo.current : t.pool)
        }
        function Ho() {
          var e = Wo()
          return null === e ? null : { parent: No._currentValue, pool: e }
        }
        var Uo = Error(l(460)),
          Go = Error(l(474)),
          qo = Error(l(542)),
          Xo = { then: function () {} }
        function Yo(e) {
          return 'fulfilled' === (e = e.status) || 'rejected' === e
        }
        function Ko() {}
        function Qo(e, t, n) {
          switch (
            (void 0 === (n = e[n]) ? e.push(t) : n !== t && (t.then(Ko, Ko), (t = n)), t.status)
          ) {
            case 'fulfilled':
              return t.value
            case 'rejected':
              throw (ea((e = t.reason)), e)
            default:
              if ('string' == typeof t.status) t.then(Ko, Ko)
              else {
                if (null !== (e = nu) && 100 < e.shellSuspendCounter) throw Error(l(482))
                ;(((e = t).status = 'pending'),
                  e.then(
                    function (e) {
                      if ('pending' === t.status) {
                        var n = t
                        ;((n.status = 'fulfilled'), (n.value = e))
                      }
                    },
                    function (e) {
                      if ('pending' === t.status) {
                        var n = t
                        ;((n.status = 'rejected'), (n.reason = e))
                      }
                    }
                  ))
              }
              switch (t.status) {
                case 'fulfilled':
                  return t.value
                case 'rejected':
                  throw (ea((e = t.reason)), e)
              }
              throw ((Zo = t), Uo)
          }
        }
        var Zo = null
        function Jo() {
          if (null === Zo) throw Error(l(459))
          var e = Zo
          return ((Zo = null), e)
        }
        function ea(e) {
          if (e === Uo || e === qo) throw Error(l(483))
        }
        var ta = !1
        function na(e) {
          e.updateQueue = {
            baseState: e.memoizedState,
            firstBaseUpdate: null,
            lastBaseUpdate: null,
            shared: { pending: null, lanes: 0, hiddenCallbacks: null },
            callbacks: null,
          }
        }
        function ra(e, t) {
          ;((e = e.updateQueue),
            t.updateQueue === e &&
              (t.updateQueue = {
                baseState: e.baseState,
                firstBaseUpdate: e.firstBaseUpdate,
                lastBaseUpdate: e.lastBaseUpdate,
                shared: e.shared,
                callbacks: null,
              }))
        }
        function oa(e) {
          return { lane: e, tag: 0, payload: null, callback: null, next: null }
        }
        function aa(e, t, n) {
          var r = e.updateQueue
          if (null === r) return null
          if (((r = r.shared), 2 & tu)) {
            var o = r.pending
            return (
              null === o ? (t.next = t) : ((t.next = o.next), (o.next = t)),
              (r.pending = t),
              (t = Nr(e)),
              Rr(e, null, n),
              t
            )
          }
          return (Er(e, r, t, n), Nr(e))
        }
        function la(e, t, n) {
          if (null !== (t = t.updateQueue) && ((t = t.shared), 4194048 & n)) {
            var r = t.lanes
            ;((n |= r &= e.pendingLanes), (t.lanes = n), _e(e, n))
          }
        }
        function ia(e, t) {
          var n = e.updateQueue,
            r = e.alternate
          if (null !== r && n === (r = r.updateQueue)) {
            var o = null,
              a = null
            if (null !== (n = n.firstBaseUpdate)) {
              do {
                var l = { lane: n.lane, tag: n.tag, payload: n.payload, callback: null, next: null }
                ;(null === a ? (o = a = l) : (a = a.next = l), (n = n.next))
              } while (null !== n)
              null === a ? (o = a = t) : (a = a.next = t)
            } else o = a = t
            return (
              (n = {
                baseState: r.baseState,
                firstBaseUpdate: o,
                lastBaseUpdate: a,
                shared: r.shared,
                callbacks: r.callbacks,
              }),
              void (e.updateQueue = n)
            )
          }
          ;(null === (e = n.lastBaseUpdate) ? (n.firstBaseUpdate = t) : (e.next = t),
            (n.lastBaseUpdate = t))
        }
        var sa = !1
        function ua() {
          if (sa && null !== $o) throw $o
        }
        function ca(e, t, n, r) {
          sa = !1
          var o = e.updateQueue
          ta = !1
          var a = o.firstBaseUpdate,
            l = o.lastBaseUpdate,
            i = o.shared.pending
          if (null !== i) {
            o.shared.pending = null
            var s = i,
              u = s.next
            ;((s.next = null), null === l ? (a = u) : (l.next = u), (l = s))
            var c = e.alternate
            null !== c &&
              (i = (c = c.updateQueue).lastBaseUpdate) !== l &&
              (null === i ? (c.firstBaseUpdate = u) : (i.next = u), (c.lastBaseUpdate = s))
          }
          if (null !== a) {
            var f = o.baseState
            for (l = 0, c = u = s = null, i = a; ; ) {
              var p = -536870913 & i.lane,
                m = p !== i.lane
              if (m ? (ou & p) === p : (r & p) === p) {
                ;(0 !== p && p === Io && (sa = !0),
                  null !== c &&
                    (c = c.next =
                      { lane: 0, tag: i.tag, payload: i.payload, callback: null, next: null }))
                e: {
                  var b = e,
                    h = i
                  p = t
                  var g = n
                  switch (h.tag) {
                    case 1:
                      if ('function' == typeof (b = h.payload)) {
                        f = b.call(g, f, p)
                        break e
                      }
                      f = b
                      break e
                    case 3:
                      b.flags = (-65537 & b.flags) | 128
                    case 0:
                      if (null == (p = 'function' == typeof (b = h.payload) ? b.call(g, f, p) : b))
                        break e
                      f = d({}, f, p)
                      break e
                    case 2:
                      ta = !0
                  }
                }
                null !== (p = i.callback) &&
                  ((e.flags |= 64),
                  m && (e.flags |= 8192),
                  null === (m = o.callbacks) ? (o.callbacks = [p]) : m.push(p))
              } else
                ((m = {
                  lane: p,
                  tag: i.tag,
                  payload: i.payload,
                  callback: i.callback,
                  next: null,
                }),
                  null === c ? ((u = c = m), (s = f)) : (c = c.next = m),
                  (l |= p))
              if (null === (i = i.next)) {
                if (null === (i = o.shared.pending)) break
                ;((i = (m = i).next),
                  (m.next = null),
                  (o.lastBaseUpdate = m),
                  (o.shared.pending = null))
              }
            }
            ;(null === c && (s = f),
              (o.baseState = s),
              (o.firstBaseUpdate = u),
              (o.lastBaseUpdate = c),
              null === a && (o.shared.lanes = 0),
              (fu |= l),
              (e.lanes = l),
              (e.memoizedState = f))
          }
        }
        function da(e, t) {
          if ('function' != typeof e) throw Error(l(191, e))
          e.call(t)
        }
        function fa(e, t) {
          var n = e.callbacks
          if (null !== n) for (e.callbacks = null, e = 0; e < n.length; e++) da(n[e], t)
        }
        var pa = $(null),
          ma = $(0)
        function ba(e, t) {
          ;(F(ma, (e = cu)), F(pa, t), (cu = e | t.baseLanes))
        }
        function ha() {
          ;(F(ma, cu), F(pa, pa.current))
        }
        function ga() {
          ;((cu = ma.current), L(pa), L(ma))
        }
        var ya = 0,
          va = null,
          Sa = null,
          wa = null,
          Oa = !1,
          ka = !1,
          xa = !1,
          Pa = 0,
          _a = 0,
          Ca = null,
          Ea = 0
        function ja() {
          throw Error(l(321))
        }
        function Ta(e, t) {
          if (null === t) return !1
          for (var n = 0; n < t.length && n < e.length; n++) if (!Xn(e[n], t[n])) return !1
          return !0
        }
        function Ra(e, t, n, r, o, a) {
          return (
            (ya = a),
            (va = t),
            (t.memoizedState = null),
            (t.updateQueue = null),
            (t.lanes = 0),
            (M.H = null === e || null === e.memoizedState ? Ul : Gl),
            (xa = !1),
            (a = n(r, o)),
            (xa = !1),
            ka && (a = Ma(t, n, r, o)),
            Na(e),
            a
          )
        }
        function Na(e) {
          M.H = Hl
          var t = null !== Sa && null !== Sa.next
          if (((ya = 0), (wa = Sa = va = null), (Oa = !1), (_a = 0), (Ca = null), t))
            throw Error(l(300))
          null === e || _i || (null !== (e = e.dependencies) && xo(e) && (_i = !0))
        }
        function Ma(e, t, n, r) {
          va = e
          var o = 0
          do {
            if ((ka && (Ca = null), (_a = 0), (ka = !1), 25 <= o)) throw Error(l(301))
            if (((o += 1), (wa = Sa = null), null != e.updateQueue)) {
              var a = e.updateQueue
              ;((a.lastEffect = null),
                (a.events = null),
                (a.stores = null),
                null != a.memoCache && (a.memoCache.index = 0))
            }
            ;((M.H = ql), (a = t(n, r)))
          } while (ka)
          return a
        }
        function Aa() {
          var e = M.H,
            t = e.useState()[0]
          return (
            (t = 'function' == typeof t.then ? Fa(t) : t),
            (e = e.useState()[0]),
            (null !== Sa ? Sa.memoizedState : null) !== e && (va.flags |= 1024),
            t
          )
        }
        function Da() {
          var e = 0 !== Pa
          return ((Pa = 0), e)
        }
        function za(e, t, n) {
          ;((t.updateQueue = e.updateQueue), (t.flags &= -2053), (e.lanes &= ~n))
        }
        function Ia(e) {
          if (Oa) {
            for (e = e.memoizedState; null !== e; ) {
              var t = e.queue
              ;(null !== t && (t.pending = null), (e = e.next))
            }
            Oa = !1
          }
          ;((ya = 0), (wa = Sa = va = null), (ka = !1), (_a = Pa = 0), (Ca = null))
        }
        function $a() {
          var e = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null }
          return (null === wa ? (va.memoizedState = wa = e) : (wa = wa.next = e), wa)
        }
        function La() {
          if (null === Sa) {
            var e = va.alternate
            e = null !== e ? e.memoizedState : null
          } else e = Sa.next
          var t = null === wa ? va.memoizedState : wa.next
          if (null !== t) ((wa = t), (Sa = e))
          else {
            if (null === e) {
              if (null === va.alternate) throw Error(l(467))
              throw Error(l(310))
            }
            ;((e = {
              memoizedState: (Sa = e).memoizedState,
              baseState: Sa.baseState,
              baseQueue: Sa.baseQueue,
              queue: Sa.queue,
              next: null,
            }),
              null === wa ? (va.memoizedState = wa = e) : (wa = wa.next = e))
          }
          return wa
        }
        function Fa(e) {
          var t = _a
          return (
            (_a += 1),
            null === Ca && (Ca = []),
            (e = Qo(Ca, e, t)),
            (t = va),
            null === (null === wa ? t.memoizedState : wa.next) &&
              ((t = t.alternate), (M.H = null === t || null === t.memoizedState ? Ul : Gl)),
            e
          )
        }
        function Va(e) {
          if (null !== e && 'object' == typeof e) {
            if ('function' == typeof e.then) return Fa(e)
            if (e.$$typeof === S) return _o(e)
          }
          throw Error(l(438, String(e)))
        }
        function Wa(e) {
          var t = null,
            n = va.updateQueue
          if ((null !== n && (t = n.memoCache), null == t)) {
            var r = va.alternate
            null !== r &&
              null !== (r = r.updateQueue) &&
              null != (r = r.memoCache) &&
              (t = {
                data: r.data.map(function (e) {
                  return e.slice()
                }),
                index: 0,
              })
          }
          if (
            (null == t && (t = { data: [], index: 0 }),
            null === n &&
              ((n = { lastEffect: null, events: null, stores: null, memoCache: null }),
              (va.updateQueue = n)),
            (n.memoCache = t),
            void 0 === (n = t.data[t.index]))
          )
            for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = C
          return (t.index++, n)
        }
        function Ba(e, t) {
          return 'function' == typeof t ? t(e) : t
        }
        function Ha(e) {
          return Ua(La(), Sa, e)
        }
        function Ua(e, t, n) {
          var r = e.queue
          if (null === r) throw Error(l(311))
          r.lastRenderedReducer = n
          var o = e.baseQueue,
            a = r.pending
          if (null !== a) {
            if (null !== o) {
              var i = o.next
              ;((o.next = a.next), (a.next = i))
            }
            ;((t.baseQueue = o = a), (r.pending = null))
          }
          if (((a = e.baseState), null === o)) e.memoizedState = a
          else {
            var s = (i = null),
              u = null,
              c = (t = o.next),
              d = !1
            do {
              var f = -536870913 & c.lane
              if (f !== c.lane ? (ou & f) === f : (ya & f) === f) {
                var p = c.revertLane
                if (0 === p)
                  (null !== u &&
                    (u = u.next =
                      {
                        lane: 0,
                        revertLane: 0,
                        action: c.action,
                        hasEagerState: c.hasEagerState,
                        eagerState: c.eagerState,
                        next: null,
                      }),
                    f === Io && (d = !0))
                else {
                  if ((ya & p) === p) {
                    ;((c = c.next), p === Io && (d = !0))
                    continue
                  }
                  ;((f = {
                    lane: 0,
                    revertLane: c.revertLane,
                    action: c.action,
                    hasEagerState: c.hasEagerState,
                    eagerState: c.eagerState,
                    next: null,
                  }),
                    null === u ? ((s = u = f), (i = a)) : (u = u.next = f),
                    (va.lanes |= p),
                    (fu |= p))
                }
                ;((f = c.action), xa && n(a, f), (a = c.hasEagerState ? c.eagerState : n(a, f)))
              } else
                ((p = {
                  lane: f,
                  revertLane: c.revertLane,
                  action: c.action,
                  hasEagerState: c.hasEagerState,
                  eagerState: c.eagerState,
                  next: null,
                }),
                  null === u ? ((s = u = p), (i = a)) : (u = u.next = p),
                  (va.lanes |= f),
                  (fu |= f))
              c = c.next
            } while (null !== c && c !== t)
            if (
              (null === u ? (i = a) : (u.next = s),
              !Xn(a, e.memoizedState) && ((_i = !0), d && null !== (n = $o)))
            )
              throw n
            ;((e.memoizedState = a),
              (e.baseState = i),
              (e.baseQueue = u),
              (r.lastRenderedState = a))
          }
          return (null === o && (r.lanes = 0), [e.memoizedState, r.dispatch])
        }
        function Ga(e) {
          var t = La(),
            n = t.queue
          if (null === n) throw Error(l(311))
          n.lastRenderedReducer = e
          var r = n.dispatch,
            o = n.pending,
            a = t.memoizedState
          if (null !== o) {
            n.pending = null
            var i = (o = o.next)
            do {
              ;((a = e(a, i.action)), (i = i.next))
            } while (i !== o)
            ;(Xn(a, t.memoizedState) || (_i = !0),
              (t.memoizedState = a),
              null === t.baseQueue && (t.baseState = a),
              (n.lastRenderedState = a))
          }
          return [a, r]
        }
        function qa(e, t, n) {
          var r = va,
            o = La(),
            a = oo
          if (a) {
            if (void 0 === n) throw Error(l(407))
            n = n()
          } else n = t()
          var i = !Xn((Sa || o).memoizedState, n)
          if (
            (i && ((o.memoizedState = n), (_i = !0)),
            (o = o.queue),
            hl(2048, 8, Ka.bind(null, r, o, e), [e]),
            o.getSnapshot !== t || i || (null !== wa && 1 & wa.memoizedState.tag))
          ) {
            if (
              ((r.flags |= 2048),
              pl(9, { destroy: void 0, resource: void 0 }, Ya.bind(null, r, o, n, t), null),
              null === nu)
            )
              throw Error(l(349))
            a || 124 & ya || Xa(r, t, n)
          }
          return n
        }
        function Xa(e, t, n) {
          ;((e.flags |= 16384),
            (e = { getSnapshot: t, value: n }),
            null === (t = va.updateQueue)
              ? ((t = { lastEffect: null, events: null, stores: null, memoCache: null }),
                (va.updateQueue = t),
                (t.stores = [e]))
              : null === (n = t.stores)
                ? (t.stores = [e])
                : n.push(e))
        }
        function Ya(e, t, n, r) {
          ;((t.value = n), (t.getSnapshot = r), Qa(t) && Za(e))
        }
        function Ka(e, t, n) {
          return n(function () {
            Qa(t) && Za(e)
          })
        }
        function Qa(e) {
          var t = e.getSnapshot
          e = e.value
          try {
            var n = t()
            return !Xn(e, n)
          } catch (e) {
            return !0
          }
        }
        function Za(e) {
          var t = Tr(e, 2)
          null !== t && Du(t, 0, 2)
        }
        function Ja(e) {
          var t = $a()
          if ('function' == typeof e) {
            var n = e
            if (((e = n()), xa)) {
              de(!0)
              try {
                n()
              } finally {
                de(!1)
              }
            }
          }
          return (
            (t.memoizedState = t.baseState = e),
            (t.queue = {
              pending: null,
              lanes: 0,
              dispatch: null,
              lastRenderedReducer: Ba,
              lastRenderedState: e,
            }),
            t
          )
        }
        function el(e, t, n, r) {
          return ((e.baseState = n), Ua(e, Sa, 'function' == typeof r ? r : Ba))
        }
        function tl(e, t, n, r, o) {
          if (Vl(e)) throw Error(l(485))
          if (null !== (e = t.action)) {
            var a = {
              payload: o,
              action: e,
              next: null,
              isTransition: !0,
              status: 'pending',
              value: null,
              reason: null,
              listeners: [],
              then: function (e) {
                a.listeners.push(e)
              },
            }
            ;(null !== M.T ? n(!0) : (a.isTransition = !1),
              r(a),
              null === (n = t.pending)
                ? ((a.next = t.pending = a), nl(t, a))
                : ((a.next = n.next), (t.pending = n.next = a)))
          }
        }
        function nl(e, t) {
          var n = t.action,
            r = t.payload,
            o = e.state
          if (t.isTransition) {
            var a = M.T,
              l = {}
            M.T = l
            try {
              var i = n(o, r),
                s = M.S
              ;(null !== s && s(l, i), rl(e, t, i))
            } catch (n) {
              al(e, t, n)
            } finally {
              M.T = a
            }
          } else
            try {
              rl(e, t, (a = n(o, r)))
            } catch (n) {
              al(e, t, n)
            }
        }
        function rl(e, t, n) {
          null !== n && 'object' == typeof n && 'function' == typeof n.then
            ? n.then(
                function (n) {
                  ol(e, t, n)
                },
                function (n) {
                  return al(e, t, n)
                }
              )
            : ol(e, t, n)
        }
        function ol(e, t, n) {
          ;((t.status = 'fulfilled'),
            (t.value = n),
            ll(t),
            (e.state = n),
            null !== (t = e.pending) &&
              ((n = t.next) === t ? (e.pending = null) : ((n = n.next), (t.next = n), nl(e, n))))
        }
        function al(e, t, n) {
          var r = e.pending
          if (((e.pending = null), null !== r)) {
            r = r.next
            do {
              ;((t.status = 'rejected'), (t.reason = n), ll(t), (t = t.next))
            } while (t !== r)
          }
          e.action = null
        }
        function ll(e) {
          e = e.listeners
          for (var t = 0; t < e.length; t++) (0, e[t])()
        }
        function il(e, t) {
          return t
        }
        function sl(e, t) {
          if (oo) {
            var n = nu.formState
            if (null !== n) {
              e: {
                var r = va
                if (oo) {
                  if (ro) {
                    t: {
                      for (var o = ro, a = lo; 8 !== o.nodeType; ) {
                        if (!a) {
                          o = null
                          break t
                        }
                        if (null === (o = hd(o.nextSibling))) {
                          o = null
                          break t
                        }
                      }
                      o = 'F!' === (a = o.data) || 'F' === a ? o : null
                    }
                    if (o) {
                      ;((ro = hd(o.nextSibling)), (r = 'F!' === o.data))
                      break e
                    }
                  }
                  so(r)
                }
                r = !1
              }
              r && (t = n[0])
            }
          }
          return (
            ((n = $a()).memoizedState = n.baseState = t),
            (r = {
              pending: null,
              lanes: 0,
              dispatch: null,
              lastRenderedReducer: il,
              lastRenderedState: t,
            }),
            (n.queue = r),
            (n = $l.bind(null, va, r)),
            (r.dispatch = n),
            (r = Ja(!1)),
            (a = Fl.bind(null, va, !1, r.queue)),
            (o = { state: t, dispatch: null, action: e, pending: null }),
            ((r = $a()).queue = o),
            (n = tl.bind(null, va, o, a, n)),
            (o.dispatch = n),
            (r.memoizedState = e),
            [t, n, !1]
          )
        }
        function ul(e) {
          return cl(La(), Sa, e)
        }
        function cl(e, t, n) {
          if (
            ((t = Ua(e, t, il)[0]),
            (e = Ha(Ba)[0]),
            'object' == typeof t && null !== t && 'function' == typeof t.then)
          )
            try {
              var r = Fa(t)
            } catch (e) {
              if (e === Uo) throw qo
              throw e
            }
          else r = t
          var o = (t = La()).queue,
            a = o.dispatch
          return (
            n !== t.memoizedState &&
              ((va.flags |= 2048),
              pl(9, { destroy: void 0, resource: void 0 }, dl.bind(null, o, n), null)),
            [r, a, e]
          )
        }
        function dl(e, t) {
          e.action = t
        }
        function fl(e) {
          var t = La(),
            n = Sa
          if (null !== n) return cl(t, n, e)
          ;(La(), (t = t.memoizedState))
          var r = (n = La()).queue.dispatch
          return ((n.memoizedState = e), [t, r, !1])
        }
        function pl(e, t, n, r) {
          return (
            (e = { tag: e, create: n, deps: r, inst: t, next: null }),
            null === (t = va.updateQueue) &&
              ((t = { lastEffect: null, events: null, stores: null, memoCache: null }),
              (va.updateQueue = t)),
            null === (n = t.lastEffect)
              ? (t.lastEffect = e.next = e)
              : ((r = n.next), (n.next = e), (e.next = r), (t.lastEffect = e)),
            e
          )
        }
        function ml() {
          return La().memoizedState
        }
        function bl(e, t, n, r) {
          var o = $a()
          ;((r = void 0 === r ? null : r),
            (va.flags |= e),
            (o.memoizedState = pl(1 | t, { destroy: void 0, resource: void 0 }, n, r)))
        }
        function hl(e, t, n, r) {
          var o = La()
          r = void 0 === r ? null : r
          var a = o.memoizedState.inst
          null !== Sa && null !== r && Ta(r, Sa.memoizedState.deps)
            ? (o.memoizedState = pl(t, a, n, r))
            : ((va.flags |= e), (o.memoizedState = pl(1 | t, a, n, r)))
        }
        function gl(e, t) {
          bl(8390656, 8, e, t)
        }
        function yl(e, t) {
          hl(2048, 8, e, t)
        }
        function vl(e, t) {
          return hl(4, 2, e, t)
        }
        function Sl(e, t) {
          return hl(4, 4, e, t)
        }
        function wl(e, t) {
          if ('function' == typeof t) {
            e = e()
            var n = t(e)
            return function () {
              'function' == typeof n ? n() : t(null)
            }
          }
          if (null != t)
            return (
              (e = e()),
              (t.current = e),
              function () {
                t.current = null
              }
            )
        }
        function Ol(e, t, n) {
          ;((n = null != n ? n.concat([e]) : null), hl(4, 4, wl.bind(null, t, e), n))
        }
        function kl() {}
        function xl(e, t) {
          var n = La()
          t = void 0 === t ? null : t
          var r = n.memoizedState
          return null !== t && Ta(t, r[1]) ? r[0] : ((n.memoizedState = [e, t]), e)
        }
        function Pl(e, t) {
          var n = La()
          t = void 0 === t ? null : t
          var r = n.memoizedState
          if (null !== t && Ta(t, r[1])) return r[0]
          if (((r = e()), xa)) {
            de(!0)
            try {
              e()
            } finally {
              de(!1)
            }
          }
          return ((n.memoizedState = [r, t]), r)
        }
        function _l(e, t, n) {
          return void 0 === n || 1073741824 & ya
            ? (e.memoizedState = t)
            : ((e.memoizedState = n), (e = Au()), (va.lanes |= e), (fu |= e), n)
        }
        function Cl(e, t, n, r) {
          return Xn(n, t)
            ? n
            : null !== pa.current
              ? ((e = _l(e, n, r)), Xn(e, t) || (_i = !0), e)
              : 42 & ya
                ? ((e = Au()), (va.lanes |= e), (fu |= e), t)
                : ((_i = !0), (e.memoizedState = n))
        }
        function El(e, t, n, r, o) {
          var a = A.p
          A.p = 0 !== a && 8 > a ? a : 8
          var l,
            i,
            s,
            u = M.T,
            c = {}
          ;((M.T = c), Fl(e, !1, t, n))
          try {
            var d = o(),
              f = M.S
            ;(null !== f && f(c, d),
              null !== d && 'object' == typeof d && 'function' == typeof d.then
                ? Ll(
                    e,
                    t,
                    ((l = r),
                    (i = []),
                    (s = {
                      status: 'pending',
                      value: null,
                      reason: null,
                      then: function (e) {
                        i.push(e)
                      },
                    }),
                    d.then(
                      function () {
                        ;((s.status = 'fulfilled'), (s.value = l))
                        for (var e = 0; e < i.length; e++) (0, i[e])(l)
                      },
                      function (e) {
                        for (s.status = 'rejected', s.reason = e, e = 0; e < i.length; e++)
                          (0, i[e])(void 0)
                      }
                    ),
                    s),
                    Mu()
                  )
                : Ll(e, t, r, Mu()))
          } catch (n) {
            Ll(e, t, { then: function () {}, status: 'rejected', reason: n }, Mu())
          } finally {
            ;((A.p = a), (M.T = u))
          }
        }
        function jl() {}
        function Tl(e, t, n, r) {
          if (5 !== e.tag) throw Error(l(476))
          var o = Rl(e).queue
          El(
            e,
            o,
            t,
            D,
            null === n
              ? jl
              : function () {
                  return (Nl(e), n(r))
                }
          )
        }
        function Rl(e) {
          var t = e.memoizedState
          if (null !== t) return t
          var n = {}
          return (
            ((t = {
              memoizedState: D,
              baseState: D,
              baseQueue: null,
              queue: {
                pending: null,
                lanes: 0,
                dispatch: null,
                lastRenderedReducer: Ba,
                lastRenderedState: D,
              },
              next: null,
            }).next = {
              memoizedState: n,
              baseState: n,
              baseQueue: null,
              queue: {
                pending: null,
                lanes: 0,
                dispatch: null,
                lastRenderedReducer: Ba,
                lastRenderedState: n,
              },
              next: null,
            }),
            (e.memoizedState = t),
            null !== (e = e.alternate) && (e.memoizedState = t),
            t
          )
        }
        function Nl(e) {
          Ll(e, Rl(e).next.queue, {}, Mu())
        }
        function Ml() {
          return _o(qd)
        }
        function Al() {
          return La().memoizedState
        }
        function Dl() {
          return La().memoizedState
        }
        function zl(e) {
          for (var t = e.return; null !== t; ) {
            switch (t.tag) {
              case 24:
              case 3:
                var n = Mu(),
                  r = aa(t, (e = oa(n)), n)
                return (
                  null !== r && (Du(r, 0, n), la(r, t, n)),
                  (t = { cache: Mo() }),
                  void (e.payload = t)
                )
            }
            t = t.return
          }
        }
        function Il(e, t, n) {
          var r = Mu()
          ;((n = {
            lane: r,
            revertLane: 0,
            action: n,
            hasEagerState: !1,
            eagerState: null,
            next: null,
          }),
            Vl(e) ? Wl(t, n) : null !== (n = jr(e, t, n, r)) && (Du(n, 0, r), Bl(n, t, r)))
        }
        function $l(e, t, n) {
          Ll(e, t, n, Mu())
        }
        function Ll(e, t, n, r) {
          var o = {
            lane: r,
            revertLane: 0,
            action: n,
            hasEagerState: !1,
            eagerState: null,
            next: null,
          }
          if (Vl(e)) Wl(t, o)
          else {
            var a = e.alternate
            if (
              0 === e.lanes &&
              (null === a || 0 === a.lanes) &&
              null !== (a = t.lastRenderedReducer)
            )
              try {
                var l = t.lastRenderedState,
                  i = a(l, n)
                if (((o.hasEagerState = !0), (o.eagerState = i), Xn(i, l)))
                  return (Er(e, t, o, 0), null === nu && Cr(), !1)
              } catch (e) {}
            if (null !== (n = jr(e, t, o, r))) return (Du(n, 0, r), Bl(n, t, r), !0)
          }
          return !1
        }
        function Fl(e, t, n, r) {
          if (
            ((r = {
              lane: 2,
              revertLane: Ec(),
              action: r,
              hasEagerState: !1,
              eagerState: null,
              next: null,
            }),
            Vl(e))
          ) {
            if (t) throw Error(l(479))
          } else null !== (t = jr(e, n, r, 2)) && Du(t, 0, 2)
        }
        function Vl(e) {
          var t = e.alternate
          return e === va || (null !== t && t === va)
        }
        function Wl(e, t) {
          ka = Oa = !0
          var n = e.pending
          ;(null === n ? (t.next = t) : ((t.next = n.next), (n.next = t)), (e.pending = t))
        }
        function Bl(e, t, n) {
          if (4194048 & n) {
            var r = t.lanes
            ;((n |= r &= e.pendingLanes), (t.lanes = n), _e(e, n))
          }
        }
        var Hl = {
            readContext: _o,
            use: Va,
            useCallback: ja,
            useContext: ja,
            useEffect: ja,
            useImperativeHandle: ja,
            useLayoutEffect: ja,
            useInsertionEffect: ja,
            useMemo: ja,
            useReducer: ja,
            useRef: ja,
            useState: ja,
            useDebugValue: ja,
            useDeferredValue: ja,
            useTransition: ja,
            useSyncExternalStore: ja,
            useId: ja,
            useHostTransitionStatus: ja,
            useFormState: ja,
            useActionState: ja,
            useOptimistic: ja,
            useMemoCache: ja,
            useCacheRefresh: ja,
          },
          Ul = {
            readContext: _o,
            use: Va,
            useCallback: function (e, t) {
              return (($a().memoizedState = [e, void 0 === t ? null : t]), e)
            },
            useContext: _o,
            useEffect: gl,
            useImperativeHandle: function (e, t, n) {
              ;((n = null != n ? n.concat([e]) : null), bl(4194308, 4, wl.bind(null, t, e), n))
            },
            useLayoutEffect: function (e, t) {
              return bl(4194308, 4, e, t)
            },
            useInsertionEffect: function (e, t) {
              bl(4, 2, e, t)
            },
            useMemo: function (e, t) {
              var n = $a()
              t = void 0 === t ? null : t
              var r = e()
              if (xa) {
                de(!0)
                try {
                  e()
                } finally {
                  de(!1)
                }
              }
              return ((n.memoizedState = [r, t]), r)
            },
            useReducer: function (e, t, n) {
              var r = $a()
              if (void 0 !== n) {
                var o = n(t)
                if (xa) {
                  de(!0)
                  try {
                    n(t)
                  } finally {
                    de(!1)
                  }
                }
              } else o = t
              return (
                (r.memoizedState = r.baseState = o),
                (e = {
                  pending: null,
                  lanes: 0,
                  dispatch: null,
                  lastRenderedReducer: e,
                  lastRenderedState: o,
                }),
                (r.queue = e),
                (e = e.dispatch = Il.bind(null, va, e)),
                [r.memoizedState, e]
              )
            },
            useRef: function (e) {
              return ((e = { current: e }), ($a().memoizedState = e))
            },
            useState: function (e) {
              var t = (e = Ja(e)).queue,
                n = $l.bind(null, va, t)
              return ((t.dispatch = n), [e.memoizedState, n])
            },
            useDebugValue: kl,
            useDeferredValue: function (e, t) {
              return _l($a(), e, t)
            },
            useTransition: function () {
              var e = Ja(!1)
              return ((e = El.bind(null, va, e.queue, !0, !1)), ($a().memoizedState = e), [!1, e])
            },
            useSyncExternalStore: function (e, t, n) {
              var r = va,
                o = $a()
              if (oo) {
                if (void 0 === n) throw Error(l(407))
                n = n()
              } else {
                if (((n = t()), null === nu)) throw Error(l(349))
                124 & ou || Xa(r, t, n)
              }
              o.memoizedState = n
              var a = { value: n, getSnapshot: t }
              return (
                (o.queue = a),
                gl(Ka.bind(null, r, a, e), [e]),
                (r.flags |= 2048),
                pl(9, { destroy: void 0, resource: void 0 }, Ya.bind(null, r, a, n, t), null),
                n
              )
            },
            useId: function () {
              var e = $a(),
                t = nu.identifierPrefix
              if (oo) {
                var n = Qr
                ;((t = '«' + t + 'R' + (n = (Kr & ~(1 << (32 - fe(Kr) - 1))).toString(32) + n)),
                  0 < (n = Pa++) && (t += 'H' + n.toString(32)),
                  (t += '»'))
              } else t = '«' + t + 'r' + (n = Ea++).toString(32) + '»'
              return (e.memoizedState = t)
            },
            useHostTransitionStatus: Ml,
            useFormState: sl,
            useActionState: sl,
            useOptimistic: function (e) {
              var t = $a()
              t.memoizedState = t.baseState = e
              var n = {
                pending: null,
                lanes: 0,
                dispatch: null,
                lastRenderedReducer: null,
                lastRenderedState: null,
              }
              return ((t.queue = n), (t = Fl.bind(null, va, !0, n)), (n.dispatch = t), [e, t])
            },
            useMemoCache: Wa,
            useCacheRefresh: function () {
              return ($a().memoizedState = zl.bind(null, va))
            },
          },
          Gl = {
            readContext: _o,
            use: Va,
            useCallback: xl,
            useContext: _o,
            useEffect: yl,
            useImperativeHandle: Ol,
            useInsertionEffect: vl,
            useLayoutEffect: Sl,
            useMemo: Pl,
            useReducer: Ha,
            useRef: ml,
            useState: function () {
              return Ha(Ba)
            },
            useDebugValue: kl,
            useDeferredValue: function (e, t) {
              return Cl(La(), Sa.memoizedState, e, t)
            },
            useTransition: function () {
              var e = Ha(Ba)[0],
                t = La().memoizedState
              return ['boolean' == typeof e ? e : Fa(e), t]
            },
            useSyncExternalStore: qa,
            useId: Al,
            useHostTransitionStatus: Ml,
            useFormState: ul,
            useActionState: ul,
            useOptimistic: function (e, t) {
              return el(La(), 0, e, t)
            },
            useMemoCache: Wa,
            useCacheRefresh: Dl,
          },
          ql = {
            readContext: _o,
            use: Va,
            useCallback: xl,
            useContext: _o,
            useEffect: yl,
            useImperativeHandle: Ol,
            useInsertionEffect: vl,
            useLayoutEffect: Sl,
            useMemo: Pl,
            useReducer: Ga,
            useRef: ml,
            useState: function () {
              return Ga(Ba)
            },
            useDebugValue: kl,
            useDeferredValue: function (e, t) {
              var n = La()
              return null === Sa ? _l(n, e, t) : Cl(n, Sa.memoizedState, e, t)
            },
            useTransition: function () {
              var e = Ga(Ba)[0],
                t = La().memoizedState
              return ['boolean' == typeof e ? e : Fa(e), t]
            },
            useSyncExternalStore: qa,
            useId: Al,
            useHostTransitionStatus: Ml,
            useFormState: fl,
            useActionState: fl,
            useOptimistic: function (e, t) {
              var n = La()
              return null !== Sa ? el(n, 0, e, t) : ((n.baseState = e), [e, n.queue.dispatch])
            },
            useMemoCache: Wa,
            useCacheRefresh: Dl,
          },
          Xl = null,
          Yl = 0
        function Kl(e) {
          var t = Yl
          return ((Yl += 1), null === Xl && (Xl = []), Qo(Xl, e, t))
        }
        function Ql(e, t) {
          ;((t = t.props.ref), (e.ref = void 0 !== t ? t : null))
        }
        function Zl(e, t) {
          if (t.$$typeof === f) throw Error(l(525))
          throw (
            (e = Object.prototype.toString.call(t)),
            Error(
              l(
                31,
                '[object Object]' === e ? 'object with keys {' + Object.keys(t).join(', ') + '}' : e
              )
            )
          )
        }
        function Jl(e) {
          return (0, e._init)(e._payload)
        }
        function ei(e) {
          function t(t, n) {
            if (e) {
              var r = t.deletions
              null === r ? ((t.deletions = [n]), (t.flags |= 16)) : r.push(n)
            }
          }
          function n(n, r) {
            if (!e) return null
            for (; null !== r; ) (t(n, r), (r = r.sibling))
            return null
          }
          function r(e) {
            for (var t = new Map(); null !== e; )
              (null !== e.key ? t.set(e.key, e) : t.set(e.index, e), (e = e.sibling))
            return t
          }
          function o(e, t) {
            return (((e = Ir(e, t)).index = 0), (e.sibling = null), e)
          }
          function a(t, n, r) {
            return (
              (t.index = r),
              e
                ? null !== (r = t.alternate)
                  ? (r = r.index) < n
                    ? ((t.flags |= 67108866), n)
                    : r
                  : ((t.flags |= 67108866), n)
                : ((t.flags |= 1048576), n)
            )
          }
          function i(t) {
            return (e && null === t.alternate && (t.flags |= 67108866), t)
          }
          function s(e, t, n, r) {
            return null === t || 6 !== t.tag
              ? (((t = Vr(n, e.mode, r)).return = e), t)
              : (((t = o(t, n)).return = e), t)
          }
          function u(e, t, n, r) {
            var a = n.type
            return a === b
              ? d(e, t, n.props.children, r, n.key)
              : null !== t &&
                  (t.elementType === a ||
                    ('object' == typeof a && null !== a && a.$$typeof === P && Jl(a) === t.type))
                ? (Ql((t = o(t, n.props)), n), (t.return = e), t)
                : (Ql((t = Lr(n.type, n.key, n.props, null, e.mode, r)), n), (t.return = e), t)
          }
          function c(e, t, n, r) {
            return null === t ||
              4 !== t.tag ||
              t.stateNode.containerInfo !== n.containerInfo ||
              t.stateNode.implementation !== n.implementation
              ? (((t = Wr(n, e.mode, r)).return = e), t)
              : (((t = o(t, n.children || [])).return = e), t)
          }
          function d(e, t, n, r, a) {
            return null === t || 7 !== t.tag
              ? (((t = Fr(n, e.mode, r, a)).return = e), t)
              : (((t = o(t, n)).return = e), t)
          }
          function f(e, t, n) {
            if (('string' == typeof t && '' !== t) || 'number' == typeof t || 'bigint' == typeof t)
              return (((t = Vr('' + t, e.mode, n)).return = e), t)
            if ('object' == typeof t && null !== t) {
              switch (t.$$typeof) {
                case p:
                  return (
                    Ql((n = Lr(t.type, t.key, t.props, null, e.mode, n)), t),
                    (n.return = e),
                    n
                  )
                case m:
                  return (((t = Wr(t, e.mode, n)).return = e), t)
                case P:
                  return f(e, (t = (0, t._init)(t._payload)), n)
              }
              if (N(t) || j(t)) return (((t = Fr(t, e.mode, n, null)).return = e), t)
              if ('function' == typeof t.then) return f(e, Kl(t), n)
              if (t.$$typeof === S) return f(e, Co(e, t), n)
              Zl(e, t)
            }
            return null
          }
          function h(e, t, n, r) {
            var o = null !== t ? t.key : null
            if (('string' == typeof n && '' !== n) || 'number' == typeof n || 'bigint' == typeof n)
              return null !== o ? null : s(e, t, '' + n, r)
            if ('object' == typeof n && null !== n) {
              switch (n.$$typeof) {
                case p:
                  return n.key === o ? u(e, t, n, r) : null
                case m:
                  return n.key === o ? c(e, t, n, r) : null
                case P:
                  return h(e, t, (n = (o = n._init)(n._payload)), r)
              }
              if (N(n) || j(n)) return null !== o ? null : d(e, t, n, r, null)
              if ('function' == typeof n.then) return h(e, t, Kl(n), r)
              if (n.$$typeof === S) return h(e, t, Co(e, n), r)
              Zl(e, n)
            }
            return null
          }
          function g(e, t, n, r, o) {
            if (('string' == typeof r && '' !== r) || 'number' == typeof r || 'bigint' == typeof r)
              return s(t, (e = e.get(n) || null), '' + r, o)
            if ('object' == typeof r && null !== r) {
              switch (r.$$typeof) {
                case p:
                  return u(t, (e = e.get(null === r.key ? n : r.key) || null), r, o)
                case m:
                  return c(t, (e = e.get(null === r.key ? n : r.key) || null), r, o)
                case P:
                  return g(e, t, n, (r = (0, r._init)(r._payload)), o)
              }
              if (N(r) || j(r)) return d(t, (e = e.get(n) || null), r, o, null)
              if ('function' == typeof r.then) return g(e, t, n, Kl(r), o)
              if (r.$$typeof === S) return g(e, t, n, Co(t, r), o)
              Zl(t, r)
            }
            return null
          }
          function y(s, u, c, d) {
            if (
              ('object' == typeof c &&
                null !== c &&
                c.type === b &&
                null === c.key &&
                (c = c.props.children),
              'object' == typeof c && null !== c)
            ) {
              switch (c.$$typeof) {
                case p:
                  e: {
                    for (var v = c.key; null !== u; ) {
                      if (u.key === v) {
                        if ((v = c.type) === b) {
                          if (7 === u.tag) {
                            ;(n(s, u.sibling), ((d = o(u, c.props.children)).return = s), (s = d))
                            break e
                          }
                        } else if (
                          u.elementType === v ||
                          ('object' == typeof v &&
                            null !== v &&
                            v.$$typeof === P &&
                            Jl(v) === u.type)
                        ) {
                          ;(n(s, u.sibling), Ql((d = o(u, c.props)), c), (d.return = s), (s = d))
                          break e
                        }
                        n(s, u)
                        break
                      }
                      ;(t(s, u), (u = u.sibling))
                    }
                    c.type === b
                      ? (((d = Fr(c.props.children, s.mode, d, c.key)).return = s), (s = d))
                      : (Ql((d = Lr(c.type, c.key, c.props, null, s.mode, d)), c),
                        (d.return = s),
                        (s = d))
                  }
                  return i(s)
                case m:
                  e: {
                    for (v = c.key; null !== u; ) {
                      if (u.key === v) {
                        if (
                          4 === u.tag &&
                          u.stateNode.containerInfo === c.containerInfo &&
                          u.stateNode.implementation === c.implementation
                        ) {
                          ;(n(s, u.sibling), ((d = o(u, c.children || [])).return = s), (s = d))
                          break e
                        }
                        n(s, u)
                        break
                      }
                      ;(t(s, u), (u = u.sibling))
                    }
                    ;(((d = Wr(c, s.mode, d)).return = s), (s = d))
                  }
                  return i(s)
                case P:
                  return y(s, u, (c = (v = c._init)(c._payload)), d)
              }
              if (N(c))
                return (function (o, l, i, s) {
                  for (
                    var u = null, c = null, d = l, p = (l = 0), m = null;
                    null !== d && p < i.length;
                    p++
                  ) {
                    d.index > p ? ((m = d), (d = null)) : (m = d.sibling)
                    var b = h(o, d, i[p], s)
                    if (null === b) {
                      null === d && (d = m)
                      break
                    }
                    ;(e && d && null === b.alternate && t(o, d),
                      (l = a(b, l, p)),
                      null === c ? (u = b) : (c.sibling = b),
                      (c = b),
                      (d = m))
                  }
                  if (p === i.length) return (n(o, d), oo && Zr(o, p), u)
                  if (null === d) {
                    for (; p < i.length; p++)
                      null !== (d = f(o, i[p], s)) &&
                        ((l = a(d, l, p)), null === c ? (u = d) : (c.sibling = d), (c = d))
                    return (oo && Zr(o, p), u)
                  }
                  for (d = r(d); p < i.length; p++)
                    null !== (m = g(d, o, p, i[p], s)) &&
                      (e && null !== m.alternate && d.delete(null === m.key ? p : m.key),
                      (l = a(m, l, p)),
                      null === c ? (u = m) : (c.sibling = m),
                      (c = m))
                  return (
                    e &&
                      d.forEach(function (e) {
                        return t(o, e)
                      }),
                    oo && Zr(o, p),
                    u
                  )
                })(s, u, c, d)
              if (j(c)) {
                if ('function' != typeof (v = j(c))) throw Error(l(150))
                return (function (o, i, s, u) {
                  if (null == s) throw Error(l(151))
                  for (
                    var c = null, d = null, p = i, m = (i = 0), b = null, y = s.next();
                    null !== p && !y.done;
                    m++, y = s.next()
                  ) {
                    p.index > m ? ((b = p), (p = null)) : (b = p.sibling)
                    var v = h(o, p, y.value, u)
                    if (null === v) {
                      null === p && (p = b)
                      break
                    }
                    ;(e && p && null === v.alternate && t(o, p),
                      (i = a(v, i, m)),
                      null === d ? (c = v) : (d.sibling = v),
                      (d = v),
                      (p = b))
                  }
                  if (y.done) return (n(o, p), oo && Zr(o, m), c)
                  if (null === p) {
                    for (; !y.done; m++, y = s.next())
                      null !== (y = f(o, y.value, u)) &&
                        ((i = a(y, i, m)), null === d ? (c = y) : (d.sibling = y), (d = y))
                    return (oo && Zr(o, m), c)
                  }
                  for (p = r(p); !y.done; m++, y = s.next())
                    null !== (y = g(p, o, m, y.value, u)) &&
                      (e && null !== y.alternate && p.delete(null === y.key ? m : y.key),
                      (i = a(y, i, m)),
                      null === d ? (c = y) : (d.sibling = y),
                      (d = y))
                  return (
                    e &&
                      p.forEach(function (e) {
                        return t(o, e)
                      }),
                    oo && Zr(o, m),
                    c
                  )
                })(s, u, (c = v.call(c)), d)
              }
              if ('function' == typeof c.then) return y(s, u, Kl(c), d)
              if (c.$$typeof === S) return y(s, u, Co(s, c), d)
              Zl(s, c)
            }
            return ('string' == typeof c && '' !== c) ||
              'number' == typeof c ||
              'bigint' == typeof c
              ? ((c = '' + c),
                null !== u && 6 === u.tag
                  ? (n(s, u.sibling), ((d = o(u, c)).return = s), (s = d))
                  : (n(s, u), ((d = Vr(c, s.mode, d)).return = s), (s = d)),
                i(s))
              : n(s, u)
          }
          return function (e, t, n, r) {
            try {
              Yl = 0
              var o = y(e, t, n, r)
              return ((Xl = null), o)
            } catch (t) {
              if (t === Uo || t === qo) throw t
              var a = Dr(29, t, null, e.mode)
              return ((a.lanes = r), (a.return = e), a)
            }
          }
        }
        var ti = ei(!0),
          ni = ei(!1),
          ri = $(null),
          oi = null
        function ai(e) {
          var t = e.alternate
          ;(F(ui, 1 & ui.current),
            F(ri, e),
            null === oi &&
              (null === t || null !== pa.current || null !== t.memoizedState) &&
              (oi = e))
        }
        function li(e) {
          if (22 === e.tag) {
            if ((F(ui, ui.current), F(ri, e), null === oi)) {
              var t = e.alternate
              null !== t && null !== t.memoizedState && (oi = e)
            }
          } else ii()
        }
        function ii() {
          ;(F(ui, ui.current), F(ri, ri.current))
        }
        function si(e) {
          ;(L(ri), oi === e && (oi = null), L(ui))
        }
        var ui = $(0)
        function ci(e) {
          for (var t = e; null !== t; ) {
            if (13 === t.tag) {
              var n = t.memoizedState
              if (null !== n && (null === (n = n.dehydrated) || '$?' === n.data || bd(n))) return t
            } else if (19 === t.tag && void 0 !== t.memoizedProps.revealOrder) {
              if (128 & t.flags) return t
            } else if (null !== t.child) {
              ;((t.child.return = t), (t = t.child))
              continue
            }
            if (t === e) break
            for (; null === t.sibling; ) {
              if (null === t.return || t.return === e) return null
              t = t.return
            }
            ;((t.sibling.return = t.return), (t = t.sibling))
          }
          return null
        }
        function di(e, t, n, r) {
          ;((n = null == (n = n(r, (t = e.memoizedState))) ? t : d({}, t, n)),
            (e.memoizedState = n),
            0 === e.lanes && (e.updateQueue.baseState = n))
        }
        var fi = {
          enqueueSetState: function (e, t, n) {
            e = e._reactInternals
            var r = Mu(),
              o = oa(r)
            ;((o.payload = t),
              null != n && (o.callback = n),
              null !== (t = aa(e, o, r)) && (Du(t, 0, r), la(t, e, r)))
          },
          enqueueReplaceState: function (e, t, n) {
            e = e._reactInternals
            var r = Mu(),
              o = oa(r)
            ;((o.tag = 1),
              (o.payload = t),
              null != n && (o.callback = n),
              null !== (t = aa(e, o, r)) && (Du(t, 0, r), la(t, e, r)))
          },
          enqueueForceUpdate: function (e, t) {
            e = e._reactInternals
            var n = Mu(),
              r = oa(n)
            ;((r.tag = 2),
              null != t && (r.callback = t),
              null !== (t = aa(e, r, n)) && (Du(t, 0, n), la(t, e, n)))
          },
        }
        function pi(e, t, n, r, o, a, l) {
          return 'function' == typeof (e = e.stateNode).shouldComponentUpdate
            ? e.shouldComponentUpdate(r, a, l)
            : !(t.prototype && t.prototype.isPureReactComponent && Yn(n, r) && Yn(o, a))
        }
        function mi(e, t, n, r) {
          ;((e = t.state),
            'function' == typeof t.componentWillReceiveProps && t.componentWillReceiveProps(n, r),
            'function' == typeof t.UNSAFE_componentWillReceiveProps &&
              t.UNSAFE_componentWillReceiveProps(n, r),
            t.state !== e && fi.enqueueReplaceState(t, t.state, null))
        }
        function bi(e, t) {
          var n = t
          if ('ref' in t) for (var r in ((n = {}), t)) 'ref' !== r && (n[r] = t[r])
          if ((e = e.defaultProps))
            for (var o in (n === t && (n = d({}, n)), e)) void 0 === n[o] && (n[o] = e[o])
          return n
        }
        var hi =
          'function' == typeof reportError
            ? reportError
            : function (e) {
                if ('object' == typeof window && 'function' == typeof window.ErrorEvent) {
                  var t = new window.ErrorEvent('error', {
                    bubbles: !0,
                    cancelable: !0,
                    message:
                      'object' == typeof e && null !== e && 'string' == typeof e.message
                        ? String(e.message)
                        : String(e),
                    error: e,
                  })
                  if (!window.dispatchEvent(t)) return
                } else if (
                  'function' ==
                  typeof { env: { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' } }.emit
                )
                  return void { env: { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' } }.emit(
                    'uncaughtException',
                    e
                  )
                console.error(e)
              }
        function gi(e) {
          hi(e)
        }
        function yi(e) {
          console.error(e)
        }
        function vi(e) {
          hi(e)
        }
        function Si(e, t) {
          try {
            ;(0, e.onUncaughtError)(t.value, { componentStack: t.stack })
          } catch (e) {
            setTimeout(function () {
              throw e
            })
          }
        }
        function wi(e, t, n) {
          try {
            ;(0, e.onCaughtError)(n.value, {
              componentStack: n.stack,
              errorBoundary: 1 === t.tag ? t.stateNode : null,
            })
          } catch (e) {
            setTimeout(function () {
              throw e
            })
          }
        }
        function Oi(e, t, n) {
          return (
            ((n = oa(n)).tag = 3),
            (n.payload = { element: null }),
            (n.callback = function () {
              Si(e, t)
            }),
            n
          )
        }
        function ki(e) {
          return (((e = oa(e)).tag = 3), e)
        }
        function xi(e, t, n, r) {
          var o = n.type.getDerivedStateFromError
          if ('function' == typeof o) {
            var a = r.value
            ;((e.payload = function () {
              return o(a)
            }),
              (e.callback = function () {
                wi(t, n, r)
              }))
          }
          var l = n.stateNode
          null !== l &&
            'function' == typeof l.componentDidCatch &&
            (e.callback = function () {
              ;(wi(t, n, r),
                'function' != typeof o && (null === ku ? (ku = new Set([this])) : ku.add(this)))
              var e = r.stack
              this.componentDidCatch(r.value, { componentStack: null !== e ? e : '' })
            })
        }
        var Pi = Error(l(461)),
          _i = !1
        function Ci(e, t, n, r) {
          t.child = null === e ? ni(t, null, n, r) : ti(t, e.child, n, r)
        }
        function Ei(e, t, n, r, o) {
          n = n.render
          var a = t.ref
          if ('ref' in r) {
            var l = {}
            for (var i in r) 'ref' !== i && (l[i] = r[i])
          } else l = r
          return (
            Po(t),
            (r = Ra(e, t, n, l, a, o)),
            (i = Da()),
            null === e || _i
              ? (oo && i && eo(t), (t.flags |= 1), Ci(e, t, r, o), t.child)
              : (za(e, t, o), Xi(e, t, o))
          )
        }
        function ji(e, t, n, r, o) {
          if (null === e) {
            var a = n.type
            return 'function' != typeof a ||
              zr(a) ||
              void 0 !== a.defaultProps ||
              null !== n.compare
              ? (((e = Lr(n.type, null, r, t, t.mode, o)).ref = t.ref),
                (e.return = t),
                (t.child = e))
              : ((t.tag = 15), (t.type = a), Ti(e, t, a, r, o))
          }
          if (((a = e.child), !Yi(e, o))) {
            var l = a.memoizedProps
            if ((n = null !== (n = n.compare) ? n : Yn)(l, r) && e.ref === t.ref) return Xi(e, t, o)
          }
          return ((t.flags |= 1), ((e = Ir(a, r)).ref = t.ref), (e.return = t), (t.child = e))
        }
        function Ti(e, t, n, r, o) {
          if (null !== e) {
            var a = e.memoizedProps
            if (Yn(a, r) && e.ref === t.ref) {
              if (((_i = !1), (t.pendingProps = r = a), !Yi(e, o)))
                return ((t.lanes = e.lanes), Xi(e, t, o))
              131072 & e.flags && (_i = !0)
            }
          }
          return Ai(e, t, n, r, o)
        }
        function Ri(e, t, n) {
          var r = t.pendingProps,
            o = r.children,
            a = null !== e ? e.memoizedState : null
          if ('hidden' === r.mode) {
            if (128 & t.flags) {
              if (((r = null !== a ? a.baseLanes | n : n), null !== e)) {
                for (o = t.child = e.child, a = 0; null !== o; )
                  ((a = a | o.lanes | o.childLanes), (o = o.sibling))
                t.childLanes = a & ~r
              } else ((t.childLanes = 0), (t.child = null))
              return Ni(e, t, r, n)
            }
            if (!(536870912 & n))
              return (
                (t.lanes = t.childLanes = 536870912),
                Ni(e, t, null !== a ? a.baseLanes | n : n, n)
              )
            ;((t.memoizedState = { baseLanes: 0, cachePool: null }),
              null !== e && Bo(0, null !== a ? a.cachePool : null),
              null !== a ? ba(t, a) : ha(),
              li(t))
          } else
            null !== a
              ? (Bo(0, a.cachePool), ba(t, a), ii(), (t.memoizedState = null))
              : (null !== e && Bo(0, null), ha(), ii())
          return (Ci(e, t, o, n), t.child)
        }
        function Ni(e, t, n, r) {
          var o = Wo()
          return (
            (o = null === o ? null : { parent: No._currentValue, pool: o }),
            (t.memoizedState = { baseLanes: n, cachePool: o }),
            null !== e && Bo(0, null),
            ha(),
            li(t),
            null !== e && ko(e, t, r, !0),
            null
          )
        }
        function Mi(e, t) {
          var n = t.ref
          if (null === n) null !== e && null !== e.ref && (t.flags |= 4194816)
          else {
            if ('function' != typeof n && 'object' != typeof n) throw Error(l(284))
            ;(null !== e && e.ref === n) || (t.flags |= 4194816)
          }
        }
        function Ai(e, t, n, r, o) {
          return (
            Po(t),
            (n = Ra(e, t, n, r, void 0, o)),
            (r = Da()),
            null === e || _i
              ? (oo && r && eo(t), (t.flags |= 1), Ci(e, t, n, o), t.child)
              : (za(e, t, o), Xi(e, t, o))
          )
        }
        function Di(e, t, n, r, o, a) {
          return (
            Po(t),
            (t.updateQueue = null),
            (n = Ma(t, r, n, o)),
            Na(e),
            (r = Da()),
            null === e || _i
              ? (oo && r && eo(t), (t.flags |= 1), Ci(e, t, n, a), t.child)
              : (za(e, t, a), Xi(e, t, a))
          )
        }
        function zi(e, t, n, r, o) {
          if ((Po(t), null === t.stateNode)) {
            var a = Mr,
              l = n.contextType
            ;('object' == typeof l && null !== l && (a = _o(l)),
              (a = new n(r, a)),
              (t.memoizedState = null !== a.state && void 0 !== a.state ? a.state : null),
              (a.updater = fi),
              (t.stateNode = a),
              (a._reactInternals = t),
              ((a = t.stateNode).props = r),
              (a.state = t.memoizedState),
              (a.refs = {}),
              na(t),
              (l = n.contextType),
              (a.context = 'object' == typeof l && null !== l ? _o(l) : Mr),
              (a.state = t.memoizedState),
              'function' == typeof (l = n.getDerivedStateFromProps) &&
                (di(t, n, l, r), (a.state = t.memoizedState)),
              'function' == typeof n.getDerivedStateFromProps ||
                'function' == typeof a.getSnapshotBeforeUpdate ||
                ('function' != typeof a.UNSAFE_componentWillMount &&
                  'function' != typeof a.componentWillMount) ||
                ((l = a.state),
                'function' == typeof a.componentWillMount && a.componentWillMount(),
                'function' == typeof a.UNSAFE_componentWillMount && a.UNSAFE_componentWillMount(),
                l !== a.state && fi.enqueueReplaceState(a, a.state, null),
                ca(t, r, a, o),
                ua(),
                (a.state = t.memoizedState)),
              'function' == typeof a.componentDidMount && (t.flags |= 4194308),
              (r = !0))
          } else if (null === e) {
            a = t.stateNode
            var i = t.memoizedProps,
              s = bi(n, i)
            a.props = s
            var u = a.context,
              c = n.contextType
            ;((l = Mr), 'object' == typeof c && null !== c && (l = _o(c)))
            var d = n.getDerivedStateFromProps
            ;((c = 'function' == typeof d || 'function' == typeof a.getSnapshotBeforeUpdate),
              (i = t.pendingProps !== i),
              c ||
                ('function' != typeof a.UNSAFE_componentWillReceiveProps &&
                  'function' != typeof a.componentWillReceiveProps) ||
                ((i || u !== l) && mi(t, a, r, l)),
              (ta = !1))
            var f = t.memoizedState
            ;((a.state = f),
              ca(t, r, a, o),
              ua(),
              (u = t.memoizedState),
              i || f !== u || ta
                ? ('function' == typeof d && (di(t, n, d, r), (u = t.memoizedState)),
                  (s = ta || pi(t, n, s, r, f, u, l))
                    ? (c ||
                        ('function' != typeof a.UNSAFE_componentWillMount &&
                          'function' != typeof a.componentWillMount) ||
                        ('function' == typeof a.componentWillMount && a.componentWillMount(),
                        'function' == typeof a.UNSAFE_componentWillMount &&
                          a.UNSAFE_componentWillMount()),
                      'function' == typeof a.componentDidMount && (t.flags |= 4194308))
                    : ('function' == typeof a.componentDidMount && (t.flags |= 4194308),
                      (t.memoizedProps = r),
                      (t.memoizedState = u)),
                  (a.props = r),
                  (a.state = u),
                  (a.context = l),
                  (r = s))
                : ('function' == typeof a.componentDidMount && (t.flags |= 4194308), (r = !1)))
          } else {
            ;((a = t.stateNode),
              ra(e, t),
              (c = bi(n, (l = t.memoizedProps))),
              (a.props = c),
              (d = t.pendingProps),
              (f = a.context),
              (u = n.contextType),
              (s = Mr),
              'object' == typeof u && null !== u && (s = _o(u)),
              (u =
                'function' == typeof (i = n.getDerivedStateFromProps) ||
                'function' == typeof a.getSnapshotBeforeUpdate) ||
                ('function' != typeof a.UNSAFE_componentWillReceiveProps &&
                  'function' != typeof a.componentWillReceiveProps) ||
                ((l !== d || f !== s) && mi(t, a, r, s)),
              (ta = !1),
              (f = t.memoizedState),
              (a.state = f),
              ca(t, r, a, o),
              ua())
            var p = t.memoizedState
            l !== d ||
            f !== p ||
            ta ||
            (null !== e && null !== e.dependencies && xo(e.dependencies))
              ? ('function' == typeof i && (di(t, n, i, r), (p = t.memoizedState)),
                (c =
                  ta ||
                  pi(t, n, c, r, f, p, s) ||
                  (null !== e && null !== e.dependencies && xo(e.dependencies)))
                  ? (u ||
                      ('function' != typeof a.UNSAFE_componentWillUpdate &&
                        'function' != typeof a.componentWillUpdate) ||
                      ('function' == typeof a.componentWillUpdate && a.componentWillUpdate(r, p, s),
                      'function' == typeof a.UNSAFE_componentWillUpdate &&
                        a.UNSAFE_componentWillUpdate(r, p, s)),
                    'function' == typeof a.componentDidUpdate && (t.flags |= 4),
                    'function' == typeof a.getSnapshotBeforeUpdate && (t.flags |= 1024))
                  : ('function' != typeof a.componentDidUpdate ||
                      (l === e.memoizedProps && f === e.memoizedState) ||
                      (t.flags |= 4),
                    'function' != typeof a.getSnapshotBeforeUpdate ||
                      (l === e.memoizedProps && f === e.memoizedState) ||
                      (t.flags |= 1024),
                    (t.memoizedProps = r),
                    (t.memoizedState = p)),
                (a.props = r),
                (a.state = p),
                (a.context = s),
                (r = c))
              : ('function' != typeof a.componentDidUpdate ||
                  (l === e.memoizedProps && f === e.memoizedState) ||
                  (t.flags |= 4),
                'function' != typeof a.getSnapshotBeforeUpdate ||
                  (l === e.memoizedProps && f === e.memoizedState) ||
                  (t.flags |= 1024),
                (r = !1))
          }
          return (
            (a = r),
            Mi(e, t),
            (r = !!(128 & t.flags)),
            a || r
              ? ((a = t.stateNode),
                (n = r && 'function' != typeof n.getDerivedStateFromError ? null : a.render()),
                (t.flags |= 1),
                null !== e && r
                  ? ((t.child = ti(t, e.child, null, o)), (t.child = ti(t, null, n, o)))
                  : Ci(e, t, n, o),
                (t.memoizedState = a.state),
                (e = t.child))
              : (e = Xi(e, t, o)),
            e
          )
        }
        function Ii(e, t, n, r) {
          return (po(), (t.flags |= 256), Ci(e, t, n, r), t.child)
        }
        var $i = { dehydrated: null, treeContext: null, retryLane: 0, hydrationErrors: null }
        function Li(e) {
          return { baseLanes: e, cachePool: Ho() }
        }
        function Fi(e, t, n) {
          return ((e = null !== e ? e.childLanes & ~n : 0), t && (e |= bu), e)
        }
        function Vi(e, t, n) {
          var r,
            o = t.pendingProps,
            a = !1,
            i = !!(128 & t.flags)
          if (
            ((r = i) || (r = (null === e || null !== e.memoizedState) && !!(2 & ui.current)),
            r && ((a = !0), (t.flags &= -129)),
            (r = !!(32 & t.flags)),
            (t.flags &= -33),
            null === e)
          ) {
            if (oo) {
              if ((a ? ai(t) : ii(), oo)) {
                var s,
                  u = ro
                if ((s = u)) {
                  e: {
                    for (s = u, u = lo; 8 !== s.nodeType; ) {
                      if (!u) {
                        u = null
                        break e
                      }
                      if (null === (s = hd(s.nextSibling))) {
                        u = null
                        break e
                      }
                    }
                    u = s
                  }
                  null !== u
                    ? ((t.memoizedState = {
                        dehydrated: u,
                        treeContext: null !== Yr ? { id: Kr, overflow: Qr } : null,
                        retryLane: 536870912,
                        hydrationErrors: null,
                      }),
                      ((s = Dr(18, null, null, 0)).stateNode = u),
                      (s.return = t),
                      (t.child = s),
                      (no = t),
                      (ro = null),
                      (s = !0))
                    : (s = !1)
                }
                s || so(t)
              }
              if (null !== (u = t.memoizedState) && null !== (u = u.dehydrated))
                return (bd(u) ? (t.lanes = 32) : (t.lanes = 536870912), null)
              si(t)
            }
            return (
              (u = o.children),
              (o = o.fallback),
              a
                ? (ii(),
                  (u = Bi({ mode: 'hidden', children: u }, (a = t.mode))),
                  (o = Fr(o, a, n, null)),
                  (u.return = t),
                  (o.return = t),
                  (u.sibling = o),
                  (t.child = u),
                  ((a = t.child).memoizedState = Li(n)),
                  (a.childLanes = Fi(e, r, n)),
                  (t.memoizedState = $i),
                  o)
                : (ai(t), Wi(t, u))
            )
          }
          if (null !== (s = e.memoizedState) && null !== (u = s.dehydrated)) {
            if (i)
              256 & t.flags
                ? (ai(t), (t.flags &= -257), (t = Hi(e, t, n)))
                : null !== t.memoizedState
                  ? (ii(), (t.child = e.child), (t.flags |= 128), (t = null))
                  : (ii(),
                    (a = o.fallback),
                    (u = t.mode),
                    (o = Bi({ mode: 'visible', children: o.children }, u)),
                    ((a = Fr(a, u, n, null)).flags |= 2),
                    (o.return = t),
                    (a.return = t),
                    (o.sibling = a),
                    (t.child = o),
                    ti(t, e.child, null, n),
                    ((o = t.child).memoizedState = Li(n)),
                    (o.childLanes = Fi(e, r, n)),
                    (t.memoizedState = $i),
                    (t = a))
            else if ((ai(t), bd(u))) {
              if ((r = u.nextSibling && u.nextSibling.dataset)) var c = r.dgst
              ;((r = c),
                ((o = Error(l(419))).stack = ''),
                (o.digest = r),
                bo({ value: o, source: null, stack: null }),
                (t = Hi(e, t, n)))
            } else if ((_i || ko(e, t, n, !1), (r = !!(n & e.childLanes)), _i || r)) {
              if (
                null !== (r = nu) &&
                0 !== (o = (o = 42 & (o = n & -n) ? 1 : Ce(o)) & (r.suspendedLanes | n) ? 0 : o) &&
                o !== s.retryLane
              )
                throw ((s.retryLane = o), Tr(e, o), Du(r, 0, o), Pi)
              ;('$?' === u.data || Gu(), (t = Hi(e, t, n)))
            } else
              '$?' === u.data
                ? ((t.flags |= 192), (t.child = e.child), (t = null))
                : ((e = s.treeContext),
                  (ro = hd(u.nextSibling)),
                  (no = t),
                  (oo = !0),
                  (ao = null),
                  (lo = !1),
                  null !== e &&
                    ((qr[Xr++] = Kr),
                    (qr[Xr++] = Qr),
                    (qr[Xr++] = Yr),
                    (Kr = e.id),
                    (Qr = e.overflow),
                    (Yr = t)),
                  ((t = Wi(t, o.children)).flags |= 4096))
            return t
          }
          return a
            ? (ii(),
              (a = o.fallback),
              (u = t.mode),
              (c = (s = e.child).sibling),
              ((o = Ir(s, { mode: 'hidden', children: o.children })).subtreeFlags =
                65011712 & s.subtreeFlags),
              null !== c ? (a = Ir(c, a)) : ((a = Fr(a, u, n, null)).flags |= 2),
              (a.return = t),
              (o.return = t),
              (o.sibling = a),
              (t.child = o),
              (o = a),
              (a = t.child),
              null === (u = e.child.memoizedState)
                ? (u = Li(n))
                : (null !== (s = u.cachePool)
                    ? ((c = No._currentValue), (s = s.parent !== c ? { parent: c, pool: c } : s))
                    : (s = Ho()),
                  (u = { baseLanes: u.baseLanes | n, cachePool: s })),
              (a.memoizedState = u),
              (a.childLanes = Fi(e, r, n)),
              (t.memoizedState = $i),
              o)
            : (ai(t),
              (e = (n = e.child).sibling),
              ((n = Ir(n, { mode: 'visible', children: o.children })).return = t),
              (n.sibling = null),
              null !== e &&
                (null === (r = t.deletions) ? ((t.deletions = [e]), (t.flags |= 16)) : r.push(e)),
              (t.child = n),
              (t.memoizedState = null),
              n)
        }
        function Wi(e, t) {
          return (((t = Bi({ mode: 'visible', children: t }, e.mode)).return = e), (e.child = t))
        }
        function Bi(e, t) {
          return (
            ((e = Dr(22, e, null, t)).lanes = 0),
            (e.stateNode = {
              _visibility: 1,
              _pendingMarkers: null,
              _retryCache: null,
              _transitions: null,
            }),
            e
          )
        }
        function Hi(e, t, n) {
          return (
            ti(t, e.child, null, n),
            ((e = Wi(t, t.pendingProps.children)).flags |= 2),
            (t.memoizedState = null),
            e
          )
        }
        function Ui(e, t, n) {
          e.lanes |= t
          var r = e.alternate
          ;(null !== r && (r.lanes |= t), wo(e.return, t, n))
        }
        function Gi(e, t, n, r, o) {
          var a = e.memoizedState
          null === a
            ? (e.memoizedState = {
                isBackwards: t,
                rendering: null,
                renderingStartTime: 0,
                last: r,
                tail: n,
                tailMode: o,
              })
            : ((a.isBackwards = t),
              (a.rendering = null),
              (a.renderingStartTime = 0),
              (a.last = r),
              (a.tail = n),
              (a.tailMode = o))
        }
        function qi(e, t, n) {
          var r = t.pendingProps,
            o = r.revealOrder,
            a = r.tail
          if ((Ci(e, t, r.children, n), 2 & (r = ui.current))) ((r = (1 & r) | 2), (t.flags |= 128))
          else {
            if (null !== e && 128 & e.flags)
              e: for (e = t.child; null !== e; ) {
                if (13 === e.tag) null !== e.memoizedState && Ui(e, n, t)
                else if (19 === e.tag) Ui(e, n, t)
                else if (null !== e.child) {
                  ;((e.child.return = e), (e = e.child))
                  continue
                }
                if (e === t) break e
                for (; null === e.sibling; ) {
                  if (null === e.return || e.return === t) break e
                  e = e.return
                }
                ;((e.sibling.return = e.return), (e = e.sibling))
              }
            r &= 1
          }
          switch ((F(ui, r), o)) {
            case 'forwards':
              for (n = t.child, o = null; null !== n; )
                (null !== (e = n.alternate) && null === ci(e) && (o = n), (n = n.sibling))
              ;(null === (n = o)
                ? ((o = t.child), (t.child = null))
                : ((o = n.sibling), (n.sibling = null)),
                Gi(t, !1, o, n, a))
              break
            case 'backwards':
              for (n = null, o = t.child, t.child = null; null !== o; ) {
                if (null !== (e = o.alternate) && null === ci(e)) {
                  t.child = o
                  break
                }
                ;((e = o.sibling), (o.sibling = n), (n = o), (o = e))
              }
              Gi(t, !0, n, null, a)
              break
            case 'together':
              Gi(t, !1, null, null, void 0)
              break
            default:
              t.memoizedState = null
          }
          return t.child
        }
        function Xi(e, t, n) {
          if (
            (null !== e && (t.dependencies = e.dependencies), (fu |= t.lanes), !(n & t.childLanes))
          ) {
            if (null === e) return null
            if ((ko(e, t, n, !1), !(n & t.childLanes))) return null
          }
          if (null !== e && t.child !== e.child) throw Error(l(153))
          if (null !== t.child) {
            for (
              n = Ir((e = t.child), e.pendingProps), t.child = n, n.return = t;
              null !== e.sibling;

            )
              ((e = e.sibling), ((n = n.sibling = Ir(e, e.pendingProps)).return = t))
            n.sibling = null
          }
          return t.child
        }
        function Yi(e, t) {
          return !!(e.lanes & t) || !(null === (e = e.dependencies) || !xo(e))
        }
        function Ki(e, t, n) {
          if (null !== e)
            if (e.memoizedProps !== t.pendingProps) _i = !0
            else {
              if (!(Yi(e, n) || 128 & t.flags))
                return (
                  (_i = !1),
                  (function (e, t, n) {
                    switch (t.tag) {
                      case 3:
                        ;(U(t, t.stateNode.containerInfo), vo(0, No, e.memoizedState.cache), po())
                        break
                      case 27:
                      case 5:
                        q(t)
                        break
                      case 4:
                        U(t, t.stateNode.containerInfo)
                        break
                      case 10:
                        vo(0, t.type, t.memoizedProps.value)
                        break
                      case 13:
                        var r = t.memoizedState
                        if (null !== r)
                          return null !== r.dehydrated
                            ? (ai(t), (t.flags |= 128), null)
                            : n & t.child.childLanes
                              ? Vi(e, t, n)
                              : (ai(t), null !== (e = Xi(e, t, n)) ? e.sibling : null)
                        ai(t)
                        break
                      case 19:
                        var o = !!(128 & e.flags)
                        if (
                          ((r = !!(n & t.childLanes)) ||
                            (ko(e, t, n, !1), (r = !!(n & t.childLanes))),
                          o)
                        ) {
                          if (r) return qi(e, t, n)
                          t.flags |= 128
                        }
                        if (
                          (null !== (o = t.memoizedState) &&
                            ((o.rendering = null), (o.tail = null), (o.lastEffect = null)),
                          F(ui, ui.current),
                          r)
                        )
                          break
                        return null
                      case 22:
                      case 23:
                        return ((t.lanes = 0), Ri(e, t, n))
                      case 24:
                        vo(0, No, e.memoizedState.cache)
                    }
                    return Xi(e, t, n)
                  })(e, t, n)
                )
              _i = !!(131072 & e.flags)
            }
          else ((_i = !1), oo && 1048576 & t.flags && Jr(t, Gr, t.index))
          switch (((t.lanes = 0), t.tag)) {
            case 16:
              e: {
                e = t.pendingProps
                var r = t.elementType,
                  o = r._init
                if (((r = o(r._payload)), (t.type = r), 'function' != typeof r)) {
                  if (null != r) {
                    if ((o = r.$$typeof) === w) {
                      ;((t.tag = 11), (t = Ei(null, t, r, e, n)))
                      break e
                    }
                    if (o === x) {
                      ;((t.tag = 14), (t = ji(null, t, r, e, n)))
                      break e
                    }
                  }
                  throw ((t = R(r) || r), Error(l(306, t, '')))
                }
                zr(r)
                  ? ((e = bi(r, e)), (t.tag = 1), (t = zi(null, t, r, e, n)))
                  : ((t.tag = 0), (t = Ai(null, t, r, e, n)))
              }
              return t
            case 0:
              return Ai(e, t, t.type, t.pendingProps, n)
            case 1:
              return zi(e, t, (r = t.type), (o = bi(r, t.pendingProps)), n)
            case 3:
              e: {
                if ((U(t, t.stateNode.containerInfo), null === e)) throw Error(l(387))
                r = t.pendingProps
                var a = t.memoizedState
                ;((o = a.element), ra(e, t), ca(t, r, null, n))
                var i = t.memoizedState
                if (
                  ((r = i.cache),
                  vo(0, No, r),
                  r !== a.cache && Oo(t, [No], n, !0),
                  ua(),
                  (r = i.element),
                  a.isDehydrated)
                ) {
                  if (
                    ((a = { element: r, isDehydrated: !1, cache: i.cache }),
                    (t.updateQueue.baseState = a),
                    (t.memoizedState = a),
                    256 & t.flags)
                  ) {
                    t = Ii(e, t, r, n)
                    break e
                  }
                  if (r !== o) {
                    ;(bo((o = kr(Error(l(424)), t))), (t = Ii(e, t, r, n)))
                    break e
                  }
                  for (
                    e =
                      9 === (e = t.stateNode.containerInfo).nodeType
                        ? e.body
                        : 'HTML' === e.nodeName
                          ? e.ownerDocument.body
                          : e,
                      ro = hd(e.firstChild),
                      no = t,
                      oo = !0,
                      ao = null,
                      lo = !0,
                      n = ni(t, null, r, n),
                      t.child = n;
                    n;

                  )
                    ((n.flags = (-3 & n.flags) | 4096), (n = n.sibling))
                } else {
                  if ((po(), r === o)) {
                    t = Xi(e, t, n)
                    break e
                  }
                  Ci(e, t, r, n)
                }
                t = t.child
              }
              return t
            case 26:
              return (
                Mi(e, t),
                null === e
                  ? (n = Cd(t.type, null, t.pendingProps, null))
                    ? (t.memoizedState = n)
                    : oo ||
                      ((n = t.type),
                      (e = t.pendingProps),
                      ((r = nd(B.current).createElement(n))[Re] = t),
                      (r[Ne] = e),
                      Jc(r, n, e),
                      He(r),
                      (t.stateNode = r))
                  : (t.memoizedState = Cd(
                      t.type,
                      e.memoizedProps,
                      t.pendingProps,
                      e.memoizedState
                    )),
                null
              )
            case 27:
              return (
                q(t),
                null === e &&
                  oo &&
                  ((r = t.stateNode = vd(t.type, t.pendingProps, B.current)),
                  (no = t),
                  (lo = !0),
                  (o = ro),
                  fd(t.type) ? ((gd = o), (ro = hd(r.firstChild))) : (ro = o)),
                Ci(e, t, t.pendingProps.children, n),
                Mi(e, t),
                null === e && (t.flags |= 4194304),
                t.child
              )
            case 5:
              return (
                null === e &&
                  oo &&
                  ((o = r = ro) &&
                    (null !==
                    (r = (function (e, t, n, r) {
                      for (; 1 === e.nodeType; ) {
                        var o = n
                        if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
                          if (!r && ('INPUT' !== e.nodeName || 'hidden' !== e.type)) break
                        } else if (r) {
                          if (!e[$e])
                            switch (t) {
                              case 'meta':
                                if (!e.hasAttribute('itemprop')) break
                                return e
                              case 'link':
                                if (
                                  'stylesheet' === (a = e.getAttribute('rel')) &&
                                  e.hasAttribute('data-precedence')
                                )
                                  break
                                if (
                                  a !== o.rel ||
                                  e.getAttribute('href') !==
                                    (null == o.href || '' === o.href ? null : o.href) ||
                                  e.getAttribute('crossorigin') !==
                                    (null == o.crossOrigin ? null : o.crossOrigin) ||
                                  e.getAttribute('title') !== (null == o.title ? null : o.title)
                                )
                                  break
                                return e
                              case 'style':
                                if (e.hasAttribute('data-precedence')) break
                                return e
                              case 'script':
                                if (
                                  ((a = e.getAttribute('src')) !== (null == o.src ? null : o.src) ||
                                    e.getAttribute('type') !== (null == o.type ? null : o.type) ||
                                    e.getAttribute('crossorigin') !==
                                      (null == o.crossOrigin ? null : o.crossOrigin)) &&
                                  a &&
                                  e.hasAttribute('async') &&
                                  !e.hasAttribute('itemprop')
                                )
                                  break
                                return e
                              default:
                                return e
                            }
                        } else {
                          if ('input' !== t || 'hidden' !== e.type) return e
                          var a = null == o.name ? null : '' + o.name
                          if ('hidden' === o.type && e.getAttribute('name') === a) return e
                        }
                        if (null === (e = hd(e.nextSibling))) break
                      }
                      return null
                    })(r, t.type, t.pendingProps, lo))
                      ? ((t.stateNode = r), (no = t), (ro = hd(r.firstChild)), (lo = !1), (o = !0))
                      : (o = !1)),
                  o || so(t)),
                q(t),
                (o = t.type),
                (a = t.pendingProps),
                (i = null !== e ? e.memoizedProps : null),
                (r = a.children),
                ad(o, a) ? (r = null) : null !== i && ad(o, i) && (t.flags |= 32),
                null !== t.memoizedState &&
                  ((o = Ra(e, t, Aa, null, null, n)), (qd._currentValue = o)),
                Mi(e, t),
                Ci(e, t, r, n),
                t.child
              )
            case 6:
              return (
                null === e &&
                  oo &&
                  ((e = n = ro) &&
                    (null !==
                    (n = (function (e, t, n) {
                      if ('' === t) return null
                      for (; 3 !== e.nodeType; ) {
                        if (
                          (1 !== e.nodeType || 'INPUT' !== e.nodeName || 'hidden' !== e.type) &&
                          !n
                        )
                          return null
                        if (null === (e = hd(e.nextSibling))) return null
                      }
                      return e
                    })(n, t.pendingProps, lo))
                      ? ((t.stateNode = n), (no = t), (ro = null), (e = !0))
                      : (e = !1)),
                  e || so(t)),
                null
              )
            case 13:
              return Vi(e, t, n)
            case 4:
              return (
                U(t, t.stateNode.containerInfo),
                (r = t.pendingProps),
                null === e ? (t.child = ti(t, null, r, n)) : Ci(e, t, r, n),
                t.child
              )
            case 11:
              return Ei(e, t, t.type, t.pendingProps, n)
            case 7:
              return (Ci(e, t, t.pendingProps, n), t.child)
            case 8:
            case 12:
              return (Ci(e, t, t.pendingProps.children, n), t.child)
            case 10:
              return (
                (r = t.pendingProps),
                vo(0, t.type, r.value),
                Ci(e, t, r.children, n),
                t.child
              )
            case 9:
              return (
                (o = t.type._context),
                (r = t.pendingProps.children),
                Po(t),
                (r = r((o = _o(o)))),
                (t.flags |= 1),
                Ci(e, t, r, n),
                t.child
              )
            case 14:
              return ji(e, t, t.type, t.pendingProps, n)
            case 15:
              return Ti(e, t, t.type, t.pendingProps, n)
            case 19:
              return qi(e, t, n)
            case 31:
              return (
                (r = t.pendingProps),
                (n = t.mode),
                (r = { mode: r.mode, children: r.children }),
                null === e
                  ? (((n = Bi(r, n)).ref = t.ref), (t.child = n), (n.return = t), (t = n))
                  : (((n = Ir(e.child, r)).ref = t.ref), (t.child = n), (n.return = t), (t = n)),
                t
              )
            case 22:
              return Ri(e, t, n)
            case 24:
              return (
                Po(t),
                (r = _o(No)),
                null === e
                  ? (null === (o = Wo()) &&
                      ((o = nu),
                      (a = Mo()),
                      (o.pooledCache = a),
                      a.refCount++,
                      null !== a && (o.pooledCacheLanes |= n),
                      (o = a)),
                    (t.memoizedState = { parent: r, cache: o }),
                    na(t),
                    vo(0, No, o))
                  : (!!(e.lanes & n) && (ra(e, t), ca(t, null, null, n), ua()),
                    (o = e.memoizedState),
                    (a = t.memoizedState),
                    o.parent !== r
                      ? ((o = { parent: r, cache: r }),
                        (t.memoizedState = o),
                        0 === t.lanes && (t.memoizedState = t.updateQueue.baseState = o),
                        vo(0, No, r))
                      : ((r = a.cache), vo(0, No, r), r !== o.cache && Oo(t, [No], n, !0))),
                Ci(e, t, t.pendingProps.children, n),
                t.child
              )
            case 29:
              throw t.pendingProps
          }
          throw Error(l(156, t.tag))
        }
        function Qi(e) {
          e.flags |= 4
        }
        function Zi(e, t) {
          if ('stylesheet' !== t.type || 4 & t.state.loading) e.flags &= -16777217
          else if (((e.flags |= 16777216), !Fd(t))) {
            if (
              null !== (t = ri.current) &&
              ((4194048 & ou) === ou
                ? null !== oi
                : ((62914560 & ou) !== ou && !(536870912 & ou)) || t !== oi)
            )
              throw ((Zo = Xo), Go)
            e.flags |= 8192
          }
        }
        function Ji(e, t) {
          ;(null !== t && (e.flags |= 4),
            16384 & e.flags && ((t = 22 !== e.tag ? Oe() : 536870912), (e.lanes |= t), (hu |= t)))
        }
        function es(e, t) {
          if (!oo)
            switch (e.tailMode) {
              case 'hidden':
                t = e.tail
                for (var n = null; null !== t; ) (null !== t.alternate && (n = t), (t = t.sibling))
                null === n ? (e.tail = null) : (n.sibling = null)
                break
              case 'collapsed':
                n = e.tail
                for (var r = null; null !== n; ) (null !== n.alternate && (r = n), (n = n.sibling))
                null === r
                  ? t || null === e.tail
                    ? (e.tail = null)
                    : (e.tail.sibling = null)
                  : (r.sibling = null)
            }
        }
        function ts(e) {
          var t = null !== e.alternate && e.alternate.child === e.child,
            n = 0,
            r = 0
          if (t)
            for (var o = e.child; null !== o; )
              ((n |= o.lanes | o.childLanes),
                (r |= 65011712 & o.subtreeFlags),
                (r |= 65011712 & o.flags),
                (o.return = e),
                (o = o.sibling))
          else
            for (o = e.child; null !== o; )
              ((n |= o.lanes | o.childLanes),
                (r |= o.subtreeFlags),
                (r |= o.flags),
                (o.return = e),
                (o = o.sibling))
          return ((e.subtreeFlags |= r), (e.childLanes = n), t)
        }
        function ns(e, t, n) {
          var r = t.pendingProps
          switch ((to(t), t.tag)) {
            case 31:
            case 16:
            case 15:
            case 0:
            case 11:
            case 7:
            case 8:
            case 12:
            case 9:
            case 14:
            case 1:
              return (ts(t), null)
            case 3:
              return (
                (n = t.stateNode),
                (r = null),
                null !== e && (r = e.memoizedState.cache),
                t.memoizedState.cache !== r && (t.flags |= 2048),
                So(No),
                G(),
                n.pendingContext && ((n.context = n.pendingContext), (n.pendingContext = null)),
                (null !== e && null !== e.child) ||
                  (fo(t)
                    ? Qi(t)
                    : null === e ||
                      (e.memoizedState.isDehydrated && !(256 & t.flags)) ||
                      ((t.flags |= 1024), mo())),
                ts(t),
                null
              )
            case 26:
              return (
                (n = t.memoizedState),
                null === e
                  ? (Qi(t), null !== n ? (ts(t), Zi(t, n)) : (ts(t), (t.flags &= -16777217)))
                  : n
                    ? n !== e.memoizedState
                      ? (Qi(t), ts(t), Zi(t, n))
                      : (ts(t), (t.flags &= -16777217))
                    : (e.memoizedProps !== r && Qi(t), ts(t), (t.flags &= -16777217)),
                null
              )
            case 27:
              ;(X(t), (n = B.current))
              var o = t.type
              if (null !== e && null != t.stateNode) e.memoizedProps !== r && Qi(t)
              else {
                if (!r) {
                  if (null === t.stateNode) throw Error(l(166))
                  return (ts(t), null)
                }
                ;((e = V.current), fo(t) ? uo(t) : ((e = vd(o, r, n)), (t.stateNode = e), Qi(t)))
              }
              return (ts(t), null)
            case 5:
              if ((X(t), (n = t.type), null !== e && null != t.stateNode))
                e.memoizedProps !== r && Qi(t)
              else {
                if (!r) {
                  if (null === t.stateNode) throw Error(l(166))
                  return (ts(t), null)
                }
                if (((e = V.current), fo(t))) uo(t)
                else {
                  switch (((o = nd(B.current)), e)) {
                    case 1:
                      e = o.createElementNS('http://www.w3.org/2000/svg', n)
                      break
                    case 2:
                      e = o.createElementNS('http://www.w3.org/1998/Math/MathML', n)
                      break
                    default:
                      switch (n) {
                        case 'svg':
                          e = o.createElementNS('http://www.w3.org/2000/svg', n)
                          break
                        case 'math':
                          e = o.createElementNS('http://www.w3.org/1998/Math/MathML', n)
                          break
                        case 'script':
                          ;(((e = o.createElement('div')).innerHTML = '<script><\/script>'),
                            (e = e.removeChild(e.firstChild)))
                          break
                        case 'select':
                          ;((e =
                            'string' == typeof r.is
                              ? o.createElement('select', { is: r.is })
                              : o.createElement('select')),
                            r.multiple ? (e.multiple = !0) : r.size && (e.size = r.size))
                          break
                        default:
                          e =
                            'string' == typeof r.is
                              ? o.createElement(n, { is: r.is })
                              : o.createElement(n)
                      }
                  }
                  ;((e[Re] = t), (e[Ne] = r))
                  e: for (o = t.child; null !== o; ) {
                    if (5 === o.tag || 6 === o.tag) e.appendChild(o.stateNode)
                    else if (4 !== o.tag && 27 !== o.tag && null !== o.child) {
                      ;((o.child.return = o), (o = o.child))
                      continue
                    }
                    if (o === t) break e
                    for (; null === o.sibling; ) {
                      if (null === o.return || o.return === t) break e
                      o = o.return
                    }
                    ;((o.sibling.return = o.return), (o = o.sibling))
                  }
                  t.stateNode = e
                  e: switch ((Jc(e, n, r), n)) {
                    case 'button':
                    case 'input':
                    case 'select':
                    case 'textarea':
                      e = !!r.autoFocus
                      break e
                    case 'img':
                      e = !0
                      break e
                    default:
                      e = !1
                  }
                  e && Qi(t)
                }
              }
              return (ts(t), (t.flags &= -16777217), null)
            case 6:
              if (e && null != t.stateNode) e.memoizedProps !== r && Qi(t)
              else {
                if ('string' != typeof r && null === t.stateNode) throw Error(l(166))
                if (((e = B.current), fo(t))) {
                  if (((e = t.stateNode), (n = t.memoizedProps), (r = null), null !== (o = no)))
                    switch (o.tag) {
                      case 27:
                      case 5:
                        r = o.memoizedProps
                    }
                  ;((e[Re] = t),
                    (e = !!(
                      e.nodeValue === n ||
                      (null !== r && !0 === r.suppressHydrationWarning) ||
                      Yc(e.nodeValue, n)
                    )) || so(t))
                } else (((e = nd(e).createTextNode(r))[Re] = t), (t.stateNode = e))
              }
              return (ts(t), null)
            case 13:
              if (
                ((r = t.memoizedState),
                null === e || (null !== e.memoizedState && null !== e.memoizedState.dehydrated))
              ) {
                if (((o = fo(t)), null !== r && null !== r.dehydrated)) {
                  if (null === e) {
                    if (!o) throw Error(l(318))
                    if (!(o = null !== (o = t.memoizedState) ? o.dehydrated : null))
                      throw Error(l(317))
                    o[Re] = t
                  } else (po(), !(128 & t.flags) && (t.memoizedState = null), (t.flags |= 4))
                  ;(ts(t), (o = !1))
                } else
                  ((o = mo()),
                    null !== e && null !== e.memoizedState && (e.memoizedState.hydrationErrors = o),
                    (o = !0))
                if (!o) return 256 & t.flags ? (si(t), t) : (si(t), null)
              }
              if ((si(t), 128 & t.flags)) return ((t.lanes = n), t)
              if (((n = null !== r), (e = null !== e && null !== e.memoizedState), n)) {
                ;((o = null),
                  null !== (r = t.child).alternate &&
                    null !== r.alternate.memoizedState &&
                    null !== r.alternate.memoizedState.cachePool &&
                    (o = r.alternate.memoizedState.cachePool.pool))
                var a = null
                ;(null !== r.memoizedState &&
                  null !== r.memoizedState.cachePool &&
                  (a = r.memoizedState.cachePool.pool),
                  a !== o && (r.flags |= 2048))
              }
              return (n !== e && n && (t.child.flags |= 8192), Ji(t, t.updateQueue), ts(t), null)
            case 4:
              return (G(), null === e && Lc(t.stateNode.containerInfo), ts(t), null)
            case 10:
              return (So(t.type), ts(t), null)
            case 19:
              if ((L(ui), null === (o = t.memoizedState))) return (ts(t), null)
              if (((r = !!(128 & t.flags)), null === (a = o.rendering)))
                if (r) es(o, !1)
                else {
                  if (0 !== du || (null !== e && 128 & e.flags))
                    for (e = t.child; null !== e; ) {
                      if (null !== (a = ci(e))) {
                        for (
                          t.flags |= 128,
                            es(o, !1),
                            e = a.updateQueue,
                            t.updateQueue = e,
                            Ji(t, e),
                            t.subtreeFlags = 0,
                            e = n,
                            n = t.child;
                          null !== n;

                        )
                          ($r(n, e), (n = n.sibling))
                        return (F(ui, (1 & ui.current) | 2), t.child)
                      }
                      e = e.sibling
                    }
                  null !== o.tail &&
                    ee() > wu &&
                    ((t.flags |= 128), (r = !0), es(o, !1), (t.lanes = 4194304))
                }
              else {
                if (!r)
                  if (null !== (e = ci(a))) {
                    if (
                      ((t.flags |= 128),
                      (r = !0),
                      (e = e.updateQueue),
                      (t.updateQueue = e),
                      Ji(t, e),
                      es(o, !0),
                      null === o.tail && 'hidden' === o.tailMode && !a.alternate && !oo)
                    )
                      return (ts(t), null)
                  } else
                    2 * ee() - o.renderingStartTime > wu &&
                      536870912 !== n &&
                      ((t.flags |= 128), (r = !0), es(o, !1), (t.lanes = 4194304))
                o.isBackwards
                  ? ((a.sibling = t.child), (t.child = a))
                  : (null !== (e = o.last) ? (e.sibling = a) : (t.child = a), (o.last = a))
              }
              return null !== o.tail
                ? ((t = o.tail),
                  (o.rendering = t),
                  (o.tail = t.sibling),
                  (o.renderingStartTime = ee()),
                  (t.sibling = null),
                  (e = ui.current),
                  F(ui, r ? (1 & e) | 2 : 1 & e),
                  t)
                : (ts(t), null)
            case 22:
            case 23:
              return (
                si(t),
                ga(),
                (r = null !== t.memoizedState),
                null !== e
                  ? (null !== e.memoizedState) !== r && (t.flags |= 8192)
                  : r && (t.flags |= 8192),
                r
                  ? !!(536870912 & n) &&
                    !(128 & t.flags) &&
                    (ts(t), 6 & t.subtreeFlags && (t.flags |= 8192))
                  : ts(t),
                null !== (n = t.updateQueue) && Ji(t, n.retryQueue),
                (n = null),
                null !== e &&
                  null !== e.memoizedState &&
                  null !== e.memoizedState.cachePool &&
                  (n = e.memoizedState.cachePool.pool),
                (r = null),
                null !== t.memoizedState &&
                  null !== t.memoizedState.cachePool &&
                  (r = t.memoizedState.cachePool.pool),
                r !== n && (t.flags |= 2048),
                null !== e && L(Vo),
                null
              )
            case 24:
              return (
                (n = null),
                null !== e && (n = e.memoizedState.cache),
                t.memoizedState.cache !== n && (t.flags |= 2048),
                So(No),
                ts(t),
                null
              )
            case 25:
            case 30:
              return null
          }
          throw Error(l(156, t.tag))
        }
        function rs(e, t) {
          switch ((to(t), t.tag)) {
            case 1:
              return 65536 & (e = t.flags) ? ((t.flags = (-65537 & e) | 128), t) : null
            case 3:
              return (
                So(No),
                G(),
                65536 & (e = t.flags) && !(128 & e) ? ((t.flags = (-65537 & e) | 128), t) : null
              )
            case 26:
            case 27:
            case 5:
              return (X(t), null)
            case 13:
              if ((si(t), null !== (e = t.memoizedState) && null !== e.dehydrated)) {
                if (null === t.alternate) throw Error(l(340))
                po()
              }
              return 65536 & (e = t.flags) ? ((t.flags = (-65537 & e) | 128), t) : null
            case 19:
              return (L(ui), null)
            case 4:
              return (G(), null)
            case 10:
              return (So(t.type), null)
            case 22:
            case 23:
              return (
                si(t),
                ga(),
                null !== e && L(Vo),
                65536 & (e = t.flags) ? ((t.flags = (-65537 & e) | 128), t) : null
              )
            case 24:
              return (So(No), null)
            default:
              return null
          }
        }
        function os(e, t) {
          switch ((to(t), t.tag)) {
            case 3:
              ;(So(No), G())
              break
            case 26:
            case 27:
            case 5:
              X(t)
              break
            case 4:
              G()
              break
            case 13:
              si(t)
              break
            case 19:
              L(ui)
              break
            case 10:
              So(t.type)
              break
            case 22:
            case 23:
              ;(si(t), ga(), null !== e && L(Vo))
              break
            case 24:
              So(No)
          }
        }
        function as(e, t) {
          try {
            var n = t.updateQueue,
              r = null !== n ? n.lastEffect : null
            if (null !== r) {
              var o = r.next
              n = o
              do {
                if ((n.tag & e) === e) {
                  r = void 0
                  var a = n.create,
                    l = n.inst
                  ;((r = a()), (l.destroy = r))
                }
                n = n.next
              } while (n !== o)
            }
          } catch (e) {
            uc(t, t.return, e)
          }
        }
        function ls(e, t, n) {
          try {
            var r = t.updateQueue,
              o = null !== r ? r.lastEffect : null
            if (null !== o) {
              var a = o.next
              r = a
              do {
                if ((r.tag & e) === e) {
                  var l = r.inst,
                    i = l.destroy
                  if (void 0 !== i) {
                    ;((l.destroy = void 0), (o = t))
                    var s = n,
                      u = i
                    try {
                      u()
                    } catch (e) {
                      uc(o, s, e)
                    }
                  }
                }
                r = r.next
              } while (r !== a)
            }
          } catch (e) {
            uc(t, t.return, e)
          }
        }
        function is(e) {
          var t = e.updateQueue
          if (null !== t) {
            var n = e.stateNode
            try {
              fa(t, n)
            } catch (t) {
              uc(e, e.return, t)
            }
          }
        }
        function ss(e, t, n) {
          ;((n.props = bi(e.type, e.memoizedProps)), (n.state = e.memoizedState))
          try {
            n.componentWillUnmount()
          } catch (n) {
            uc(e, t, n)
          }
        }
        function us(e, t) {
          try {
            var n = e.ref
            if (null !== n) {
              switch (e.tag) {
                case 26:
                case 27:
                case 5:
                  var r = e.stateNode
                  break
                default:
                  r = e.stateNode
              }
              'function' == typeof n ? (e.refCleanup = n(r)) : (n.current = r)
            }
          } catch (n) {
            uc(e, t, n)
          }
        }
        function cs(e, t) {
          var n = e.ref,
            r = e.refCleanup
          if (null !== n)
            if ('function' == typeof r)
              try {
                r()
              } catch (n) {
                uc(e, t, n)
              } finally {
                ;((e.refCleanup = null), null != (e = e.alternate) && (e.refCleanup = null))
              }
            else if ('function' == typeof n)
              try {
                n(null)
              } catch (n) {
                uc(e, t, n)
              }
            else n.current = null
        }
        function ds(e) {
          var t = e.type,
            n = e.memoizedProps,
            r = e.stateNode
          try {
            e: switch (t) {
              case 'button':
              case 'input':
              case 'select':
              case 'textarea':
                n.autoFocus && r.focus()
                break e
              case 'img':
                n.src ? (r.src = n.src) : n.srcSet && (r.srcset = n.srcSet)
            }
          } catch (t) {
            uc(e, e.return, t)
          }
        }
        function fs(e, t, n) {
          try {
            var r = e.stateNode
            ;(!(function (e, t, n, r) {
              switch (t) {
                case 'div':
                case 'span':
                case 'svg':
                case 'path':
                case 'a':
                case 'g':
                case 'p':
                case 'li':
                  break
                case 'input':
                  var o = null,
                    a = null,
                    i = null,
                    s = null,
                    u = null,
                    c = null,
                    d = null
                  for (m in n) {
                    var f = n[m]
                    if (n.hasOwnProperty(m) && null != f)
                      switch (m) {
                        case 'checked':
                        case 'value':
                          break
                        case 'defaultValue':
                          u = f
                        default:
                          r.hasOwnProperty(m) || Qc(e, t, m, null, r, f)
                      }
                  }
                  for (var p in r) {
                    var m = r[p]
                    if (((f = n[p]), r.hasOwnProperty(p) && (null != m || null != f)))
                      switch (p) {
                        case 'type':
                          a = m
                          break
                        case 'name':
                          o = m
                          break
                        case 'checked':
                          c = m
                          break
                        case 'defaultChecked':
                          d = m
                          break
                        case 'value':
                          i = m
                          break
                        case 'defaultValue':
                          s = m
                          break
                        case 'children':
                        case 'dangerouslySetInnerHTML':
                          if (null != m) throw Error(l(137, t))
                          break
                        default:
                          m !== f && Qc(e, t, p, m, r, f)
                      }
                  }
                  return void bt(e, i, s, u, c, d, a, o)
                case 'select':
                  for (a in ((m = i = s = p = null), n))
                    if (((u = n[a]), n.hasOwnProperty(a) && null != u))
                      switch (a) {
                        case 'value':
                          break
                        case 'multiple':
                          m = u
                        default:
                          r.hasOwnProperty(a) || Qc(e, t, a, null, r, u)
                      }
                  for (o in r)
                    if (((a = r[o]), (u = n[o]), r.hasOwnProperty(o) && (null != a || null != u)))
                      switch (o) {
                        case 'value':
                          p = a
                          break
                        case 'defaultValue':
                          s = a
                          break
                        case 'multiple':
                          i = a
                        default:
                          a !== u && Qc(e, t, o, a, r, u)
                      }
                  return (
                    (t = s),
                    (n = i),
                    (r = m),
                    void (null != p
                      ? yt(e, !!n, p, !1)
                      : !!r != !!n && (null != t ? yt(e, !!n, t, !0) : yt(e, !!n, n ? [] : '', !1)))
                  )
                case 'textarea':
                  for (s in ((m = p = null), n))
                    if (((o = n[s]), n.hasOwnProperty(s) && null != o && !r.hasOwnProperty(s)))
                      switch (s) {
                        case 'value':
                        case 'children':
                          break
                        default:
                          Qc(e, t, s, null, r, o)
                      }
                  for (i in r)
                    if (((o = r[i]), (a = n[i]), r.hasOwnProperty(i) && (null != o || null != a)))
                      switch (i) {
                        case 'value':
                          p = o
                          break
                        case 'defaultValue':
                          m = o
                          break
                        case 'children':
                          break
                        case 'dangerouslySetInnerHTML':
                          if (null != o) throw Error(l(91))
                          break
                        default:
                          o !== a && Qc(e, t, i, o, r, a)
                      }
                  return void vt(e, p, m)
                case 'option':
                  for (var b in n)
                    ((p = n[b]),
                      n.hasOwnProperty(b) &&
                        null != p &&
                        !r.hasOwnProperty(b) &&
                        ('selected' === b ? (e.selected = !1) : Qc(e, t, b, null, r, p)))
                  for (u in r)
                    ((p = r[u]),
                      (m = n[u]),
                      !r.hasOwnProperty(u) ||
                        p === m ||
                        (null == p && null == m) ||
                        ('selected' === u
                          ? (e.selected = p && 'function' != typeof p && 'symbol' != typeof p)
                          : Qc(e, t, u, p, r, m)))
                  return
                case 'img':
                case 'link':
                case 'area':
                case 'base':
                case 'br':
                case 'col':
                case 'embed':
                case 'hr':
                case 'keygen':
                case 'meta':
                case 'param':
                case 'source':
                case 'track':
                case 'wbr':
                case 'menuitem':
                  for (var h in n)
                    ((p = n[h]),
                      n.hasOwnProperty(h) &&
                        null != p &&
                        !r.hasOwnProperty(h) &&
                        Qc(e, t, h, null, r, p))
                  for (c in r)
                    if (
                      ((p = r[c]),
                      (m = n[c]),
                      r.hasOwnProperty(c) && p !== m && (null != p || null != m))
                    )
                      switch (c) {
                        case 'children':
                        case 'dangerouslySetInnerHTML':
                          if (null != p) throw Error(l(137, t))
                          break
                        default:
                          Qc(e, t, c, p, r, m)
                      }
                  return
                default:
                  if (Pt(t)) {
                    for (var g in n)
                      ((p = n[g]),
                        n.hasOwnProperty(g) &&
                          void 0 !== p &&
                          !r.hasOwnProperty(g) &&
                          Zc(e, t, g, void 0, r, p))
                    for (d in r)
                      ((p = r[d]),
                        (m = n[d]),
                        !r.hasOwnProperty(d) ||
                          p === m ||
                          (void 0 === p && void 0 === m) ||
                          Zc(e, t, d, p, r, m))
                    return
                  }
              }
              for (var y in n)
                ((p = n[y]),
                  n.hasOwnProperty(y) &&
                    null != p &&
                    !r.hasOwnProperty(y) &&
                    Qc(e, t, y, null, r, p))
              for (f in r)
                ((p = r[f]),
                  (m = n[f]),
                  !r.hasOwnProperty(f) ||
                    p === m ||
                    (null == p && null == m) ||
                    Qc(e, t, f, p, r, m))
            })(r, e.type, n, t),
              (r[Ne] = t))
          } catch (t) {
            uc(e, e.return, t)
          }
        }
        function ps(e) {
          return (
            5 === e.tag ||
            3 === e.tag ||
            26 === e.tag ||
            (27 === e.tag && fd(e.type)) ||
            4 === e.tag
          )
        }
        function ms(e) {
          e: for (;;) {
            for (; null === e.sibling; ) {
              if (null === e.return || ps(e.return)) return null
              e = e.return
            }
            for (
              e.sibling.return = e.return, e = e.sibling;
              5 !== e.tag && 6 !== e.tag && 18 !== e.tag;

            ) {
              if (27 === e.tag && fd(e.type)) continue e
              if (2 & e.flags) continue e
              if (null === e.child || 4 === e.tag) continue e
              ;((e.child.return = e), (e = e.child))
            }
            if (!(2 & e.flags)) return e.stateNode
          }
        }
        function bs(e, t, n) {
          var r = e.tag
          if (5 === r || 6 === r)
            ((e = e.stateNode),
              t
                ? (9 === n.nodeType
                    ? n.body
                    : 'HTML' === n.nodeName
                      ? n.ownerDocument.body
                      : n
                  ).insertBefore(e, t)
                : ((t =
                    9 === n.nodeType
                      ? n.body
                      : 'HTML' === n.nodeName
                        ? n.ownerDocument.body
                        : n).appendChild(e),
                  null != (n = n._reactRootContainer) || null !== t.onclick || (t.onclick = Kc)))
          else if (
            4 !== r &&
            (27 === r && fd(e.type) && ((n = e.stateNode), (t = null)), null !== (e = e.child))
          )
            for (bs(e, t, n), e = e.sibling; null !== e; ) (bs(e, t, n), (e = e.sibling))
        }
        function hs(e, t, n) {
          var r = e.tag
          if (5 === r || 6 === r) ((e = e.stateNode), t ? n.insertBefore(e, t) : n.appendChild(e))
          else if (4 !== r && (27 === r && fd(e.type) && (n = e.stateNode), null !== (e = e.child)))
            for (hs(e, t, n), e = e.sibling; null !== e; ) (hs(e, t, n), (e = e.sibling))
        }
        function gs(e) {
          var t = e.stateNode,
            n = e.memoizedProps
          try {
            for (var r = e.type, o = t.attributes; o.length; ) t.removeAttributeNode(o[0])
            ;(Jc(t, r, n), (t[Re] = e), (t[Ne] = n))
          } catch (t) {
            uc(e, e.return, t)
          }
        }
        var ys = !1,
          vs = !1,
          Ss = !1,
          ws = 'function' == typeof WeakSet ? WeakSet : Set,
          Os = null
        function ks(e, t, n) {
          var r = n.flags
          switch (n.tag) {
            case 0:
            case 11:
            case 15:
              ;(zs(e, n), 4 & r && as(5, n))
              break
            case 1:
              if ((zs(e, n), 4 & r))
                if (((e = n.stateNode), null === t))
                  try {
                    e.componentDidMount()
                  } catch (e) {
                    uc(n, n.return, e)
                  }
                else {
                  var o = bi(n.type, t.memoizedProps)
                  t = t.memoizedState
                  try {
                    e.componentDidUpdate(o, t, e.__reactInternalSnapshotBeforeUpdate)
                  } catch (e) {
                    uc(n, n.return, e)
                  }
                }
              ;(64 & r && is(n), 512 & r && us(n, n.return))
              break
            case 3:
              if ((zs(e, n), 64 & r && null !== (e = n.updateQueue))) {
                if (((t = null), null !== n.child))
                  switch (n.child.tag) {
                    case 27:
                    case 5:
                    case 1:
                      t = n.child.stateNode
                  }
                try {
                  fa(e, t)
                } catch (e) {
                  uc(n, n.return, e)
                }
              }
              break
            case 27:
              null === t && 4 & r && gs(n)
            case 26:
            case 5:
              ;(zs(e, n), null === t && 4 & r && ds(n), 512 & r && us(n, n.return))
              break
            case 12:
              zs(e, n)
              break
            case 13:
              ;(zs(e, n),
                4 & r && js(e, n),
                64 & r &&
                  null !== (e = n.memoizedState) &&
                  null !== (e = e.dehydrated) &&
                  (function (e, t) {
                    var n = e.ownerDocument
                    if ('$?' !== e.data || 'complete' === n.readyState) t()
                    else {
                      var r = function () {
                        ;(t(), n.removeEventListener('DOMContentLoaded', r))
                      }
                      ;(n.addEventListener('DOMContentLoaded', r), (e._reactRetry = r))
                    }
                  })(e, (n = pc.bind(null, n))))
              break
            case 22:
              if (!(r = null !== n.memoizedState || ys)) {
                ;((t = (null !== t && null !== t.memoizedState) || vs), (o = ys))
                var a = vs
                ;((ys = r),
                  (vs = t) && !a ? $s(e, n, !!(8772 & n.subtreeFlags)) : zs(e, n),
                  (ys = o),
                  (vs = a))
              }
              break
            case 30:
              break
            default:
              zs(e, n)
          }
        }
        function xs(e) {
          var t = e.alternate
          ;(null !== t && ((e.alternate = null), xs(t)),
            (e.child = null),
            (e.deletions = null),
            (e.sibling = null),
            5 === e.tag && null !== (t = e.stateNode) && Le(t),
            (e.stateNode = null),
            (e.return = null),
            (e.dependencies = null),
            (e.memoizedProps = null),
            (e.memoizedState = null),
            (e.pendingProps = null),
            (e.stateNode = null),
            (e.updateQueue = null))
        }
        var Ps = null,
          _s = !1
        function Cs(e, t, n) {
          for (n = n.child; null !== n; ) (Es(e, t, n), (n = n.sibling))
        }
        function Es(e, t, n) {
          if (ce && 'function' == typeof ce.onCommitFiberUnmount)
            try {
              ce.onCommitFiberUnmount(ue, n)
            } catch (e) {}
          switch (n.tag) {
            case 26:
              ;(vs || cs(n, t),
                Cs(e, t, n),
                n.memoizedState
                  ? n.memoizedState.count--
                  : n.stateNode && (n = n.stateNode).parentNode.removeChild(n))
              break
            case 27:
              vs || cs(n, t)
              var r = Ps,
                o = _s
              ;(fd(n.type) && ((Ps = n.stateNode), (_s = !1)),
                Cs(e, t, n),
                Sd(n.stateNode),
                (Ps = r),
                (_s = o))
              break
            case 5:
              vs || cs(n, t)
            case 6:
              if (((r = Ps), (o = _s), (Ps = null), Cs(e, t, n), (_s = o), null !== (Ps = r)))
                if (_s)
                  try {
                    ;(9 === Ps.nodeType
                      ? Ps.body
                      : 'HTML' === Ps.nodeName
                        ? Ps.ownerDocument.body
                        : Ps
                    ).removeChild(n.stateNode)
                  } catch (e) {
                    uc(n, t, e)
                  }
                else
                  try {
                    Ps.removeChild(n.stateNode)
                  } catch (e) {
                    uc(n, t, e)
                  }
              break
            case 18:
              null !== Ps &&
                (_s
                  ? (pd(
                      9 === (e = Ps).nodeType
                        ? e.body
                        : 'HTML' === e.nodeName
                          ? e.ownerDocument.body
                          : e,
                      n.stateNode
                    ),
                    Pf(e))
                  : pd(Ps, n.stateNode))
              break
            case 4:
              ;((r = Ps),
                (o = _s),
                (Ps = n.stateNode.containerInfo),
                (_s = !0),
                Cs(e, t, n),
                (Ps = r),
                (_s = o))
              break
            case 0:
            case 11:
            case 14:
            case 15:
              ;(vs || ls(2, n, t), vs || ls(4, n, t), Cs(e, t, n))
              break
            case 1:
              ;(vs ||
                (cs(n, t),
                'function' == typeof (r = n.stateNode).componentWillUnmount && ss(n, t, r)),
                Cs(e, t, n))
              break
            case 21:
              Cs(e, t, n)
              break
            case 22:
              ;((vs = (r = vs) || null !== n.memoizedState), Cs(e, t, n), (vs = r))
              break
            default:
              Cs(e, t, n)
          }
        }
        function js(e, t) {
          if (
            null === t.memoizedState &&
            null !== (e = t.alternate) &&
            null !== (e = e.memoizedState) &&
            null !== (e = e.dehydrated)
          )
            try {
              Pf(e)
            } catch (e) {
              uc(t, t.return, e)
            }
        }
        function Ts(e, t) {
          var n = (function (e) {
            switch (e.tag) {
              case 13:
              case 19:
                var t = e.stateNode
                return (null === t && (t = e.stateNode = new ws()), t)
              case 22:
                return (
                  null === (t = (e = e.stateNode)._retryCache) && (t = e._retryCache = new ws()),
                  t
                )
              default:
                throw Error(l(435, e.tag))
            }
          })(e)
          t.forEach(function (t) {
            var r = mc.bind(null, e, t)
            n.has(t) || (n.add(t), t.then(r, r))
          })
        }
        function Rs(e, t) {
          var n = t.deletions
          if (null !== n)
            for (var r = 0; r < n.length; r++) {
              var o = n[r],
                a = e,
                i = t,
                s = i
              e: for (; null !== s; ) {
                switch (s.tag) {
                  case 27:
                    if (fd(s.type)) {
                      ;((Ps = s.stateNode), (_s = !1))
                      break e
                    }
                    break
                  case 5:
                    ;((Ps = s.stateNode), (_s = !1))
                    break e
                  case 3:
                  case 4:
                    ;((Ps = s.stateNode.containerInfo), (_s = !0))
                    break e
                }
                s = s.return
              }
              if (null === Ps) throw Error(l(160))
              ;(Es(a, i, o),
                (Ps = null),
                (_s = !1),
                null !== (a = o.alternate) && (a.return = null),
                (o.return = null))
            }
          if (13878 & t.subtreeFlags) for (t = t.child; null !== t; ) (Ms(t, e), (t = t.sibling))
        }
        var Ns = null
        function Ms(e, t) {
          var n = e.alternate,
            r = e.flags
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              ;(Rs(t, e), As(e), 4 & r && (ls(3, e, e.return), as(3, e), ls(5, e, e.return)))
              break
            case 1:
              ;(Rs(t, e),
                As(e),
                512 & r && (vs || null === n || cs(n, n.return)),
                64 & r &&
                  ys &&
                  null !== (e = e.updateQueue) &&
                  null !== (r = e.callbacks) &&
                  ((n = e.shared.hiddenCallbacks),
                  (e.shared.hiddenCallbacks = null === n ? r : n.concat(r))))
              break
            case 26:
              var o = Ns
              if ((Rs(t, e), As(e), 512 & r && (vs || null === n || cs(n, n.return)), 4 & r)) {
                var a = null !== n ? n.memoizedState : null
                if (((r = e.memoizedState), null === n))
                  if (null === r)
                    if (null === e.stateNode) {
                      e: {
                        ;((r = e.type), (n = e.memoizedProps), (o = o.ownerDocument || o))
                        t: switch (r) {
                          case 'title':
                            ;((!(a = o.getElementsByTagName('title')[0]) ||
                              a[$e] ||
                              a[Re] ||
                              'http://www.w3.org/2000/svg' === a.namespaceURI ||
                              a.hasAttribute('itemprop')) &&
                              ((a = o.createElement(r)),
                              o.head.insertBefore(a, o.querySelector('head > title'))),
                              Jc(a, r, n),
                              (a[Re] = e),
                              He(a),
                              (r = a))
                            break e
                          case 'link':
                            var i = $d('link', 'href', o).get(r + (n.href || ''))
                            if (i)
                              for (var s = 0; s < i.length; s++)
                                if (
                                  (a = i[s]).getAttribute('href') ===
                                    (null == n.href || '' === n.href ? null : n.href) &&
                                  a.getAttribute('rel') === (null == n.rel ? null : n.rel) &&
                                  a.getAttribute('title') === (null == n.title ? null : n.title) &&
                                  a.getAttribute('crossorigin') ===
                                    (null == n.crossOrigin ? null : n.crossOrigin)
                                ) {
                                  i.splice(s, 1)
                                  break t
                                }
                            ;(Jc((a = o.createElement(r)), r, n), o.head.appendChild(a))
                            break
                          case 'meta':
                            if ((i = $d('meta', 'content', o).get(r + (n.content || ''))))
                              for (s = 0; s < i.length; s++)
                                if (
                                  (a = i[s]).getAttribute('content') ===
                                    (null == n.content ? null : '' + n.content) &&
                                  a.getAttribute('name') === (null == n.name ? null : n.name) &&
                                  a.getAttribute('property') ===
                                    (null == n.property ? null : n.property) &&
                                  a.getAttribute('http-equiv') ===
                                    (null == n.httpEquiv ? null : n.httpEquiv) &&
                                  a.getAttribute('charset') ===
                                    (null == n.charSet ? null : n.charSet)
                                ) {
                                  i.splice(s, 1)
                                  break t
                                }
                            ;(Jc((a = o.createElement(r)), r, n), o.head.appendChild(a))
                            break
                          default:
                            throw Error(l(468, r))
                        }
                        ;((a[Re] = e), He(a), (r = a))
                      }
                      e.stateNode = r
                    } else Ld(o, e.type, e.stateNode)
                  else e.stateNode = Md(o, r, e.memoizedProps)
                else
                  a !== r
                    ? (null === a
                        ? null !== n.stateNode && (n = n.stateNode).parentNode.removeChild(n)
                        : a.count--,
                      null === r ? Ld(o, e.type, e.stateNode) : Md(o, r, e.memoizedProps))
                    : null === r && null !== e.stateNode && fs(e, e.memoizedProps, n.memoizedProps)
              }
              break
            case 27:
              ;(Rs(t, e),
                As(e),
                512 & r && (vs || null === n || cs(n, n.return)),
                null !== n && 4 & r && fs(e, e.memoizedProps, n.memoizedProps))
              break
            case 5:
              if (
                (Rs(t, e), As(e), 512 & r && (vs || null === n || cs(n, n.return)), 32 & e.flags)
              ) {
                o = e.stateNode
                try {
                  wt(o, '')
                } catch (t) {
                  uc(e, e.return, t)
                }
              }
              ;(4 & r &&
                null != e.stateNode &&
                fs(e, (o = e.memoizedProps), null !== n ? n.memoizedProps : o),
                1024 & r && (Ss = !0))
              break
            case 6:
              if ((Rs(t, e), As(e), 4 & r)) {
                if (null === e.stateNode) throw Error(l(162))
                ;((r = e.memoizedProps), (n = e.stateNode))
                try {
                  n.nodeValue = r
                } catch (t) {
                  uc(e, e.return, t)
                }
              }
              break
            case 3:
              if (
                ((Id = null),
                (o = Ns),
                (Ns = kd(t.containerInfo)),
                Rs(t, e),
                (Ns = o),
                As(e),
                4 & r && null !== n && n.memoizedState.isDehydrated)
              )
                try {
                  Pf(t.containerInfo)
                } catch (t) {
                  uc(e, e.return, t)
                }
              Ss && ((Ss = !1), Ds(e))
              break
            case 4:
              ;((r = Ns), (Ns = kd(e.stateNode.containerInfo)), Rs(t, e), As(e), (Ns = r))
              break
            case 12:
            default:
              ;(Rs(t, e), As(e))
              break
            case 13:
              ;(Rs(t, e),
                As(e),
                8192 & e.child.flags &&
                  (null !== e.memoizedState) != (null !== n && null !== n.memoizedState) &&
                  (Su = ee()),
                4 & r && null !== (r = e.updateQueue) && ((e.updateQueue = null), Ts(e, r)))
              break
            case 22:
              o = null !== e.memoizedState
              var u = null !== n && null !== n.memoizedState,
                c = ys,
                d = vs
              if (((ys = c || o), (vs = d || u), Rs(t, e), (vs = d), (ys = c), As(e), 8192 & r))
                e: for (
                  t = e.stateNode,
                    t._visibility = o ? -2 & t._visibility : 1 | t._visibility,
                    o && (null === n || u || ys || vs || Is(e)),
                    n = null,
                    t = e;
                  ;

                ) {
                  if (5 === t.tag || 26 === t.tag) {
                    if (null === n) {
                      u = n = t
                      try {
                        if (((a = u.stateNode), o))
                          'function' == typeof (i = a.style).setProperty
                            ? i.setProperty('display', 'none', 'important')
                            : (i.display = 'none')
                        else {
                          s = u.stateNode
                          var f = u.memoizedProps.style,
                            p = null != f && f.hasOwnProperty('display') ? f.display : null
                          s.style.display =
                            null == p || 'boolean' == typeof p ? '' : ('' + p).trim()
                        }
                      } catch (e) {
                        uc(u, u.return, e)
                      }
                    }
                  } else if (6 === t.tag) {
                    if (null === n) {
                      u = t
                      try {
                        u.stateNode.nodeValue = o ? '' : u.memoizedProps
                      } catch (e) {
                        uc(u, u.return, e)
                      }
                    }
                  } else if (
                    ((22 !== t.tag && 23 !== t.tag) || null === t.memoizedState || t === e) &&
                    null !== t.child
                  ) {
                    ;((t.child.return = t), (t = t.child))
                    continue
                  }
                  if (t === e) break e
                  for (; null === t.sibling; ) {
                    if (null === t.return || t.return === e) break e
                    ;(n === t && (n = null), (t = t.return))
                  }
                  ;(n === t && (n = null), (t.sibling.return = t.return), (t = t.sibling))
                }
              4 & r &&
                null !== (r = e.updateQueue) &&
                null !== (n = r.retryQueue) &&
                ((r.retryQueue = null), Ts(e, n))
              break
            case 19:
              ;(Rs(t, e),
                As(e),
                4 & r && null !== (r = e.updateQueue) && ((e.updateQueue = null), Ts(e, r)))
            case 30:
            case 21:
          }
        }
        function As(e) {
          var t = e.flags
          if (2 & t) {
            try {
              for (var n, r = e.return; null !== r; ) {
                if (ps(r)) {
                  n = r
                  break
                }
                r = r.return
              }
              if (null == n) throw Error(l(160))
              switch (n.tag) {
                case 27:
                  var o = n.stateNode
                  hs(e, ms(e), o)
                  break
                case 5:
                  var a = n.stateNode
                  ;(32 & n.flags && (wt(a, ''), (n.flags &= -33)), hs(e, ms(e), a))
                  break
                case 3:
                case 4:
                  var i = n.stateNode.containerInfo
                  bs(e, ms(e), i)
                  break
                default:
                  throw Error(l(161))
              }
            } catch (t) {
              uc(e, e.return, t)
            }
            e.flags &= -3
          }
          4096 & t && (e.flags &= -4097)
        }
        function Ds(e) {
          if (1024 & e.subtreeFlags)
            for (e = e.child; null !== e; ) {
              var t = e
              ;(Ds(t), 5 === t.tag && 1024 & t.flags && t.stateNode.reset(), (e = e.sibling))
            }
        }
        function zs(e, t) {
          if (8772 & t.subtreeFlags)
            for (t = t.child; null !== t; ) (ks(e, t.alternate, t), (t = t.sibling))
        }
        function Is(e) {
          for (e = e.child; null !== e; ) {
            var t = e
            switch (t.tag) {
              case 0:
              case 11:
              case 14:
              case 15:
                ;(ls(4, t, t.return), Is(t))
                break
              case 1:
                cs(t, t.return)
                var n = t.stateNode
                ;('function' == typeof n.componentWillUnmount && ss(t, t.return, n), Is(t))
                break
              case 27:
                Sd(t.stateNode)
              case 26:
              case 5:
                ;(cs(t, t.return), Is(t))
                break
              case 22:
                null === t.memoizedState && Is(t)
                break
              default:
                Is(t)
            }
            e = e.sibling
          }
        }
        function $s(e, t, n) {
          for (n = n && !!(8772 & t.subtreeFlags), t = t.child; null !== t; ) {
            var r = t.alternate,
              o = e,
              a = t,
              l = a.flags
            switch (a.tag) {
              case 0:
              case 11:
              case 15:
                ;($s(o, a, n), as(4, a))
                break
              case 1:
                if (($s(o, a, n), 'function' == typeof (o = (r = a).stateNode).componentDidMount))
                  try {
                    o.componentDidMount()
                  } catch (e) {
                    uc(r, r.return, e)
                  }
                if (null !== (o = (r = a).updateQueue)) {
                  var i = r.stateNode
                  try {
                    var s = o.shared.hiddenCallbacks
                    if (null !== s)
                      for (o.shared.hiddenCallbacks = null, o = 0; o < s.length; o++) da(s[o], i)
                  } catch (e) {
                    uc(r, r.return, e)
                  }
                }
                ;(n && 64 & l && is(a), us(a, a.return))
                break
              case 27:
                gs(a)
              case 26:
              case 5:
                ;($s(o, a, n), n && null === r && 4 & l && ds(a), us(a, a.return))
                break
              case 12:
                $s(o, a, n)
                break
              case 13:
                ;($s(o, a, n), n && 4 & l && js(o, a))
                break
              case 22:
                ;(null === a.memoizedState && $s(o, a, n), us(a, a.return))
                break
              case 30:
                break
              default:
                $s(o, a, n)
            }
            t = t.sibling
          }
        }
        function Ls(e, t) {
          var n = null
          ;(null !== e &&
            null !== e.memoizedState &&
            null !== e.memoizedState.cachePool &&
            (n = e.memoizedState.cachePool.pool),
            (e = null),
            null !== t.memoizedState &&
              null !== t.memoizedState.cachePool &&
              (e = t.memoizedState.cachePool.pool),
            e !== n && (null != e && e.refCount++, null != n && Ao(n)))
        }
        function Fs(e, t) {
          ;((e = null),
            null !== t.alternate && (e = t.alternate.memoizedState.cache),
            (t = t.memoizedState.cache) !== e && (t.refCount++, null != e && Ao(e)))
        }
        function Vs(e, t, n, r) {
          if (10256 & t.subtreeFlags)
            for (t = t.child; null !== t; ) (Ws(e, t, n, r), (t = t.sibling))
        }
        function Ws(e, t, n, r) {
          var o = t.flags
          switch (t.tag) {
            case 0:
            case 11:
            case 15:
              ;(Vs(e, t, n, r), 2048 & o && as(9, t))
              break
            case 1:
            case 13:
            default:
              Vs(e, t, n, r)
              break
            case 3:
              ;(Vs(e, t, n, r),
                2048 & o &&
                  ((e = null),
                  null !== t.alternate && (e = t.alternate.memoizedState.cache),
                  (t = t.memoizedState.cache) !== e && (t.refCount++, null != e && Ao(e))))
              break
            case 12:
              if (2048 & o) {
                ;(Vs(e, t, n, r), (e = t.stateNode))
                try {
                  var a = t.memoizedProps,
                    l = a.id,
                    i = a.onPostCommit
                  'function' == typeof i &&
                    i(l, null === t.alternate ? 'mount' : 'update', e.passiveEffectDuration, -0)
                } catch (e) {
                  uc(t, t.return, e)
                }
              } else Vs(e, t, n, r)
              break
            case 23:
              break
            case 22:
              ;((a = t.stateNode),
                (l = t.alternate),
                null !== t.memoizedState
                  ? 2 & a._visibility
                    ? Vs(e, t, n, r)
                    : Hs(e, t)
                  : 2 & a._visibility
                    ? Vs(e, t, n, r)
                    : ((a._visibility |= 2), Bs(e, t, n, r, !!(10256 & t.subtreeFlags))),
                2048 & o && Ls(l, t))
              break
            case 24:
              ;(Vs(e, t, n, r), 2048 & o && Fs(t.alternate, t))
          }
        }
        function Bs(e, t, n, r, o) {
          for (o = o && !!(10256 & t.subtreeFlags), t = t.child; null !== t; ) {
            var a = e,
              l = t,
              i = n,
              s = r,
              u = l.flags
            switch (l.tag) {
              case 0:
              case 11:
              case 15:
                ;(Bs(a, l, i, s, o), as(8, l))
                break
              case 23:
                break
              case 22:
                var c = l.stateNode
                ;(null !== l.memoizedState
                  ? 2 & c._visibility
                    ? Bs(a, l, i, s, o)
                    : Hs(a, l)
                  : ((c._visibility |= 2), Bs(a, l, i, s, o)),
                  o && 2048 & u && Ls(l.alternate, l))
                break
              case 24:
                ;(Bs(a, l, i, s, o), o && 2048 & u && Fs(l.alternate, l))
                break
              default:
                Bs(a, l, i, s, o)
            }
            t = t.sibling
          }
        }
        function Hs(e, t) {
          if (10256 & t.subtreeFlags)
            for (t = t.child; null !== t; ) {
              var n = e,
                r = t,
                o = r.flags
              switch (r.tag) {
                case 22:
                  ;(Hs(n, r), 2048 & o && Ls(r.alternate, r))
                  break
                case 24:
                  ;(Hs(n, r), 2048 & o && Fs(r.alternate, r))
                  break
                default:
                  Hs(n, r)
              }
              t = t.sibling
            }
        }
        var Us = 8192
        function Gs(e) {
          if (e.subtreeFlags & Us) for (e = e.child; null !== e; ) (qs(e), (e = e.sibling))
        }
        function qs(e) {
          switch (e.tag) {
            case 26:
              ;(Gs(e),
                e.flags & Us &&
                  null !== e.memoizedState &&
                  (function (e, t, n) {
                    if (null === Vd) throw Error(l(475))
                    var r = Vd
                    if (
                      !(
                        'stylesheet' !== t.type ||
                        ('string' == typeof n.media && !1 === matchMedia(n.media).matches) ||
                        4 & t.state.loading
                      )
                    ) {
                      if (null === t.instance) {
                        var o = Ed(n.href),
                          a = e.querySelector(jd(o))
                        if (a)
                          return (
                            null !== (e = a._p) &&
                              'object' == typeof e &&
                              'function' == typeof e.then &&
                              (r.count++, (r = Bd.bind(r)), e.then(r, r)),
                            (t.state.loading |= 4),
                            (t.instance = a),
                            void He(a)
                          )
                        ;((a = e.ownerDocument || e),
                          (n = Td(n)),
                          (o = wd.get(o)) && Dd(n, o),
                          He((a = a.createElement('link'))))
                        var i = a
                        ;((i._p = new Promise(function (e, t) {
                          ;((i.onload = e), (i.onerror = t))
                        })),
                          Jc(a, 'link', n),
                          (t.instance = a))
                      }
                      ;(null === r.stylesheets && (r.stylesheets = new Map()),
                        r.stylesheets.set(t, e),
                        (e = t.state.preload) &&
                          !(3 & t.state.loading) &&
                          (r.count++,
                          (t = Bd.bind(r)),
                          e.addEventListener('load', t),
                          e.addEventListener('error', t)))
                    }
                  })(Ns, e.memoizedState, e.memoizedProps))
              break
            case 5:
            default:
              Gs(e)
              break
            case 3:
            case 4:
              var t = Ns
              ;((Ns = kd(e.stateNode.containerInfo)), Gs(e), (Ns = t))
              break
            case 22:
              null === e.memoizedState &&
                (null !== (t = e.alternate) && null !== t.memoizedState
                  ? ((t = Us), (Us = 16777216), Gs(e), (Us = t))
                  : Gs(e))
          }
        }
        function Xs(e) {
          var t = e.alternate
          if (null !== t && null !== (e = t.child)) {
            t.child = null
            do {
              ;((t = e.sibling), (e.sibling = null), (e = t))
            } while (null !== e)
          }
        }
        function Ys(e) {
          var t = e.deletions
          if (16 & e.flags) {
            if (null !== t)
              for (var n = 0; n < t.length; n++) {
                var r = t[n]
                ;((Os = r), Zs(r, e))
              }
            Xs(e)
          }
          if (10256 & e.subtreeFlags) for (e = e.child; null !== e; ) (Ks(e), (e = e.sibling))
        }
        function Ks(e) {
          switch (e.tag) {
            case 0:
            case 11:
            case 15:
              ;(Ys(e), 2048 & e.flags && ls(9, e, e.return))
              break
            case 3:
            case 12:
            default:
              Ys(e)
              break
            case 22:
              var t = e.stateNode
              null !== e.memoizedState &&
              2 & t._visibility &&
              (null === e.return || 13 !== e.return.tag)
                ? ((t._visibility &= -3), Qs(e))
                : Ys(e)
          }
        }
        function Qs(e) {
          var t = e.deletions
          if (16 & e.flags) {
            if (null !== t)
              for (var n = 0; n < t.length; n++) {
                var r = t[n]
                ;((Os = r), Zs(r, e))
              }
            Xs(e)
          }
          for (e = e.child; null !== e; ) {
            switch ((t = e).tag) {
              case 0:
              case 11:
              case 15:
                ;(ls(8, t, t.return), Qs(t))
                break
              case 22:
                2 & (n = t.stateNode)._visibility && ((n._visibility &= -3), Qs(t))
                break
              default:
                Qs(t)
            }
            e = e.sibling
          }
        }
        function Zs(e, t) {
          for (; null !== Os; ) {
            var n = Os
            switch (n.tag) {
              case 0:
              case 11:
              case 15:
                ls(8, n, t)
                break
              case 23:
              case 22:
                if (null !== n.memoizedState && null !== n.memoizedState.cachePool) {
                  var r = n.memoizedState.cachePool.pool
                  null != r && r.refCount++
                }
                break
              case 24:
                Ao(n.memoizedState.cache)
            }
            if (null !== (r = n.child)) ((r.return = n), (Os = r))
            else
              e: for (n = e; null !== Os; ) {
                var o = (r = Os).sibling,
                  a = r.return
                if ((xs(r), r === n)) {
                  Os = null
                  break e
                }
                if (null !== o) {
                  ;((o.return = a), (Os = o))
                  break e
                }
                Os = a
              }
          }
        }
        var Js = {
            getCacheForType: function (e) {
              var t = _o(No),
                n = t.data.get(e)
              return (void 0 === n && ((n = e()), t.data.set(e, n)), n)
            },
          },
          eu = 'function' == typeof WeakMap ? WeakMap : Map,
          tu = 0,
          nu = null,
          ru = null,
          ou = 0,
          au = 0,
          lu = null,
          iu = !1,
          su = !1,
          uu = !1,
          cu = 0,
          du = 0,
          fu = 0,
          pu = 0,
          mu = 0,
          bu = 0,
          hu = 0,
          gu = null,
          yu = null,
          vu = !1,
          Su = 0,
          wu = 1 / 0,
          Ou = null,
          ku = null,
          xu = 0,
          Pu = null,
          _u = null,
          Cu = 0,
          Eu = 0,
          ju = null,
          Tu = null,
          Ru = 0,
          Nu = null
        function Mu() {
          return 2 & tu && 0 !== ou ? ou & -ou : null !== M.T ? (0 !== Io ? Io : Ec()) : je()
        }
        function Au() {
          0 === bu && (bu = 536870912 & ou && !oo ? 536870912 : we())
          var e = ri.current
          return (null !== e && (e.flags |= 32), bu)
        }
        function Du(e, t, n) {
          ;(((e !== nu || (2 !== au && 9 !== au)) && null === e.cancelPendingCommit) ||
            (Wu(e, 0), Lu(e, ou, bu, !1)),
            xe(e, n),
            (2 & tu && e === nu) ||
              (e === nu && (!(2 & tu) && (pu |= n), 4 === du && Lu(e, ou, bu, !1)), wc(e)))
        }
        function zu(e, t, n) {
          if (6 & tu) throw Error(l(327))
          for (
            var r = (!n && !(124 & t) && !(t & e.expiredLanes)) || ve(e, t),
              o = r
                ? (function (e, t) {
                    var n = tu
                    tu |= 2
                    var r = Hu(),
                      o = Uu()
                    nu !== e || ou !== t
                      ? ((Ou = null), (wu = ee() + 500), Wu(e, t))
                      : (su = ve(e, t))
                    e: for (;;)
                      try {
                        if (0 !== au && null !== ru) {
                          t = ru
                          var a = lu
                          t: switch (au) {
                            case 1:
                              ;((au = 0), (lu = null), Zu(e, t, a, 1))
                              break
                            case 2:
                            case 9:
                              if (Yo(a)) {
                                ;((au = 0), (lu = null), Qu(t))
                                break
                              }
                              ;((t = function () {
                                ;((2 !== au && 9 !== au) || nu !== e || (au = 7), wc(e))
                              }),
                                a.then(t, t))
                              break e
                            case 3:
                              au = 7
                              break e
                            case 4:
                              au = 5
                              break e
                            case 7:
                              Yo(a)
                                ? ((au = 0), (lu = null), Qu(t))
                                : ((au = 0), (lu = null), Zu(e, t, a, 7))
                              break
                            case 5:
                              var i = null
                              switch (ru.tag) {
                                case 26:
                                  i = ru.memoizedState
                                case 5:
                                case 27:
                                  var s = ru
                                  if (!i || Fd(i)) {
                                    ;((au = 0), (lu = null))
                                    var u = s.sibling
                                    if (null !== u) ru = u
                                    else {
                                      var c = s.return
                                      null !== c ? ((ru = c), Ju(c)) : (ru = null)
                                    }
                                    break t
                                  }
                              }
                              ;((au = 0), (lu = null), Zu(e, t, a, 5))
                              break
                            case 6:
                              ;((au = 0), (lu = null), Zu(e, t, a, 6))
                              break
                            case 8:
                              ;(Vu(), (du = 6))
                              break e
                            default:
                              throw Error(l(462))
                          }
                        }
                        Yu()
                        break
                      } catch (t) {
                        Bu(e, t)
                      }
                    return (
                      (yo = go = null),
                      (M.H = r),
                      (M.A = o),
                      (tu = n),
                      null !== ru ? 0 : ((nu = null), (ou = 0), Cr(), du)
                    )
                  })(e, t)
                : qu(e, t, !0),
              a = r;
            ;

          ) {
            if (0 === o) {
              su && !r && Lu(e, t, 0, !1)
              break
            }
            if (((n = e.current.alternate), !a || $u(n))) {
              if (2 === o) {
                if (((a = t), e.errorRecoveryDisabledLanes & a)) var i = 0
                else i = 0 != (i = -536870913 & e.pendingLanes) ? i : 536870912 & i ? 536870912 : 0
                if (0 !== i) {
                  t = i
                  e: {
                    var s = e
                    o = gu
                    var u = s.current.memoizedState.isDehydrated
                    if ((u && (Wu(s, i).flags |= 256), 2 !== (i = qu(s, i, !1)))) {
                      if (uu && !u) {
                        ;((s.errorRecoveryDisabledLanes |= a), (pu |= a), (o = 4))
                        break e
                      }
                      ;((a = yu),
                        (yu = o),
                        null !== a && (null === yu ? (yu = a) : yu.push.apply(yu, a)))
                    }
                    o = i
                  }
                  if (((a = !1), 2 !== o)) continue
                }
              }
              if (1 === o) {
                ;(Wu(e, 0), Lu(e, t, 0, !0))
                break
              }
              e: {
                switch (((r = e), (a = o))) {
                  case 0:
                  case 1:
                    throw Error(l(345))
                  case 4:
                    if ((4194048 & t) !== t) break
                  case 6:
                    Lu(r, t, bu, !iu)
                    break e
                  case 2:
                    yu = null
                    break
                  case 3:
                  case 5:
                    break
                  default:
                    throw Error(l(329))
                }
                if ((62914560 & t) === t && 10 < (o = Su + 300 - ee())) {
                  if ((Lu(r, t, bu, !iu), 0 !== ye(r, 0, !0))) break e
                  r.timeoutHandle = id(
                    Iu.bind(null, r, n, yu, Ou, vu, t, bu, pu, hu, iu, a, 2, -0, 0),
                    o
                  )
                } else Iu(r, n, yu, Ou, vu, t, bu, pu, hu, iu, a, 0, -0, 0)
              }
              break
            }
            ;((o = qu(e, t, !1)), (a = !1))
          }
          wc(e)
        }
        function Iu(e, t, n, r, o, a, i, s, u, c, d, f, p, m) {
          if (
            ((e.timeoutHandle = -1),
            (8192 & (f = t.subtreeFlags) || !(16785408 & ~f)) &&
              ((Vd = { stylesheets: null, count: 0, unsuspend: Wd }),
              qs(t),
              null !==
                (f = (function () {
                  if (null === Vd) throw Error(l(475))
                  var e = Vd
                  return (
                    e.stylesheets && 0 === e.count && Ud(e, e.stylesheets),
                    0 < e.count
                      ? function (t) {
                          var n = setTimeout(function () {
                            if ((e.stylesheets && Ud(e, e.stylesheets), e.unsuspend)) {
                              var t = e.unsuspend
                              ;((e.unsuspend = null), t())
                            }
                          }, 6e4)
                          return (
                            (e.unsuspend = t),
                            function () {
                              ;((e.unsuspend = null), clearTimeout(n))
                            }
                          )
                        }
                      : null
                  )
                })())))
          )
            return (
              (e.cancelPendingCommit = f(tc.bind(null, e, t, a, n, r, o, i, s, u, d, 1, p, m))),
              void Lu(e, a, i, !c)
            )
          tc(e, t, a, n, r, o, i, s, u)
        }
        function $u(e) {
          for (var t = e; ; ) {
            var n = t.tag
            if (
              (0 === n || 11 === n || 15 === n) &&
              16384 & t.flags &&
              null !== (n = t.updateQueue) &&
              null !== (n = n.stores)
            )
              for (var r = 0; r < n.length; r++) {
                var o = n[r],
                  a = o.getSnapshot
                o = o.value
                try {
                  if (!Xn(a(), o)) return !1
                } catch (e) {
                  return !1
                }
              }
            if (((n = t.child), 16384 & t.subtreeFlags && null !== n)) ((n.return = t), (t = n))
            else {
              if (t === e) break
              for (; null === t.sibling; ) {
                if (null === t.return || t.return === e) return !0
                t = t.return
              }
              ;((t.sibling.return = t.return), (t = t.sibling))
            }
          }
          return !0
        }
        function Lu(e, t, n, r) {
          ;((t &= ~mu),
            (t &= ~pu),
            (e.suspendedLanes |= t),
            (e.pingedLanes &= ~t),
            r && (e.warmLanes |= t),
            (r = e.expirationTimes))
          for (var o = t; 0 < o; ) {
            var a = 31 - fe(o),
              l = 1 << a
            ;((r[a] = -1), (o &= ~l))
          }
          0 !== n && Pe(e, n, t)
        }
        function Fu() {
          return !!(6 & tu) || (Oc(0, !1), !1)
        }
        function Vu() {
          if (null !== ru) {
            if (0 === au) var e = ru.return
            else ((yo = go = null), Ia((e = ru)), (Xl = null), (Yl = 0), (e = ru))
            for (; null !== e; ) (os(e.alternate, e), (e = e.return))
            ru = null
          }
        }
        function Wu(e, t) {
          var n = e.timeoutHandle
          ;(-1 !== n && ((e.timeoutHandle = -1), sd(n)),
            null !== (n = e.cancelPendingCommit) && ((e.cancelPendingCommit = null), n()),
            Vu(),
            (nu = e),
            (ru = n = Ir(e.current, null)),
            (ou = t),
            (au = 0),
            (lu = null),
            (iu = !1),
            (su = ve(e, t)),
            (uu = !1),
            (hu = bu = mu = pu = fu = du = 0),
            (yu = gu = null),
            (vu = !1),
            8 & t && (t |= 32 & t))
          var r = e.entangledLanes
          if (0 !== r)
            for (e = e.entanglements, r &= t; 0 < r; ) {
              var o = 31 - fe(r),
                a = 1 << o
              ;((t |= e[o]), (r &= ~a))
            }
          return ((cu = t), Cr(), n)
        }
        function Bu(e, t) {
          ;((va = null),
            (M.H = Hl),
            t === Uo || t === qo
              ? ((t = Jo()), (au = 3))
              : t === Go
                ? ((t = Jo()), (au = 4))
                : (au =
                    t === Pi
                      ? 8
                      : null !== t && 'object' == typeof t && 'function' == typeof t.then
                        ? 6
                        : 1),
            (lu = t),
            null === ru && ((du = 1), Si(e, kr(t, e.current))))
        }
        function Hu() {
          var e = M.H
          return ((M.H = Hl), null === e ? Hl : e)
        }
        function Uu() {
          var e = M.A
          return ((M.A = Js), e)
        }
        function Gu() {
          ;((du = 4),
            iu || ((4194048 & ou) !== ou && null !== ri.current) || (su = !0),
            (!(134217727 & fu) && !(134217727 & pu)) || null === nu || Lu(nu, ou, bu, !1))
        }
        function qu(e, t, n) {
          var r = tu
          tu |= 2
          var o = Hu(),
            a = Uu()
          ;((nu === e && ou === t) || ((Ou = null), Wu(e, t)), (t = !1))
          var l = du
          e: for (;;)
            try {
              if (0 !== au && null !== ru) {
                var i = ru,
                  s = lu
                switch (au) {
                  case 8:
                    ;(Vu(), (l = 6))
                    break e
                  case 3:
                  case 2:
                  case 9:
                  case 6:
                    null === ri.current && (t = !0)
                    var u = au
                    if (((au = 0), (lu = null), Zu(e, i, s, u), n && su)) {
                      l = 0
                      break e
                    }
                    break
                  default:
                    ;((u = au), (au = 0), (lu = null), Zu(e, i, s, u))
                }
              }
              ;(Xu(), (l = du))
              break
            } catch (t) {
              Bu(e, t)
            }
          return (
            t && e.shellSuspendCounter++,
            (yo = go = null),
            (tu = r),
            (M.H = o),
            (M.A = a),
            null === ru && ((nu = null), (ou = 0), Cr()),
            l
          )
        }
        function Xu() {
          for (; null !== ru; ) Ku(ru)
        }
        function Yu() {
          for (; null !== ru && !Z(); ) Ku(ru)
        }
        function Ku(e) {
          var t = Ki(e.alternate, e, cu)
          ;((e.memoizedProps = e.pendingProps), null === t ? Ju(e) : (ru = t))
        }
        function Qu(e) {
          var t = e,
            n = t.alternate
          switch (t.tag) {
            case 15:
            case 0:
              t = Di(n, t, t.pendingProps, t.type, void 0, ou)
              break
            case 11:
              t = Di(n, t, t.pendingProps, t.type.render, t.ref, ou)
              break
            case 5:
              Ia(t)
            default:
              ;(os(n, t), (t = Ki(n, (t = ru = $r(t, cu)), cu)))
          }
          ;((e.memoizedProps = e.pendingProps), null === t ? Ju(e) : (ru = t))
        }
        function Zu(e, t, n, r) {
          ;((yo = go = null), Ia(t), (Xl = null), (Yl = 0))
          var o = t.return
          try {
            if (
              (function (e, t, n, r, o) {
                if (
                  ((n.flags |= 32768),
                  null !== r && 'object' == typeof r && 'function' == typeof r.then)
                ) {
                  if ((null !== (t = n.alternate) && ko(t, n, o, !0), null !== (n = ri.current))) {
                    switch (n.tag) {
                      case 13:
                        return (
                          null === oi ? Gu() : null === n.alternate && 0 === du && (du = 3),
                          (n.flags &= -257),
                          (n.flags |= 65536),
                          (n.lanes = o),
                          r === Xo
                            ? (n.flags |= 16384)
                            : (null === (t = n.updateQueue)
                                ? (n.updateQueue = new Set([r]))
                                : t.add(r),
                              cc(e, r, o)),
                          !1
                        )
                      case 22:
                        return (
                          (n.flags |= 65536),
                          r === Xo
                            ? (n.flags |= 16384)
                            : (null === (t = n.updateQueue)
                                ? ((t = {
                                    transitions: null,
                                    markerInstances: null,
                                    retryQueue: new Set([r]),
                                  }),
                                  (n.updateQueue = t))
                                : null === (n = t.retryQueue)
                                  ? (t.retryQueue = new Set([r]))
                                  : n.add(r),
                              cc(e, r, o)),
                          !1
                        )
                    }
                    throw Error(l(435, n.tag))
                  }
                  return (cc(e, r, o), Gu(), !1)
                }
                if (oo)
                  return (
                    null !== (t = ri.current)
                      ? (!(65536 & t.flags) && (t.flags |= 256),
                        (t.flags |= 65536),
                        (t.lanes = o),
                        r !== io && bo(kr((e = Error(l(422), { cause: r })), n)))
                      : (r !== io && bo(kr((t = Error(l(423), { cause: r })), n)),
                        ((e = e.current.alternate).flags |= 65536),
                        (o &= -o),
                        (e.lanes |= o),
                        (r = kr(r, n)),
                        ia(e, (o = Oi(e.stateNode, r, o))),
                        4 !== du && (du = 2)),
                    !1
                  )
                var a = Error(l(520), { cause: r })
                if (
                  ((a = kr(a, n)),
                  null === gu ? (gu = [a]) : gu.push(a),
                  4 !== du && (du = 2),
                  null === t)
                )
                  return !0
                ;((r = kr(r, n)), (n = t))
                do {
                  switch (n.tag) {
                    case 3:
                      return (
                        (n.flags |= 65536),
                        (e = o & -o),
                        (n.lanes |= e),
                        ia(n, (e = Oi(n.stateNode, r, e))),
                        !1
                      )
                    case 1:
                      if (
                        ((t = n.type),
                        (a = n.stateNode),
                        !(
                          128 & n.flags ||
                          ('function' != typeof t.getDerivedStateFromError &&
                            (null === a ||
                              'function' != typeof a.componentDidCatch ||
                              (null !== ku && ku.has(a))))
                        ))
                      )
                        return (
                          (n.flags |= 65536),
                          (o &= -o),
                          (n.lanes |= o),
                          xi((o = ki(o)), e, n, r),
                          ia(n, o),
                          !1
                        )
                  }
                  n = n.return
                } while (null !== n)
                return !1
              })(e, o, t, n, ou)
            )
              return ((du = 1), Si(e, kr(n, e.current)), void (ru = null))
          } catch (t) {
            if (null !== o) throw ((ru = o), t)
            return ((du = 1), Si(e, kr(n, e.current)), void (ru = null))
          }
          32768 & t.flags
            ? (oo || 1 === r
                ? (e = !0)
                : su || 536870912 & ou
                  ? (e = !1)
                  : ((iu = e = !0),
                    (2 === r || 9 === r || 3 === r || 6 === r) &&
                      null !== (r = ri.current) &&
                      13 === r.tag &&
                      (r.flags |= 16384)),
              ec(t, e))
            : Ju(t)
        }
        function Ju(e) {
          var t = e
          do {
            if (32768 & t.flags) return void ec(t, iu)
            e = t.return
            var n = ns(t.alternate, t, cu)
            if (null !== n) return void (ru = n)
            if (null !== (t = t.sibling)) return void (ru = t)
            ru = t = e
          } while (null !== t)
          0 === du && (du = 5)
        }
        function ec(e, t) {
          do {
            var n = rs(e.alternate, e)
            if (null !== n) return ((n.flags &= 32767), void (ru = n))
            if (
              (null !== (n = e.return) &&
                ((n.flags |= 32768), (n.subtreeFlags = 0), (n.deletions = null)),
              !t && null !== (e = e.sibling))
            )
              return void (ru = e)
            ru = e = n
          } while (null !== e)
          ;((du = 6), (ru = null))
        }
        function tc(e, t, n, r, o, a, i, s, u) {
          e.cancelPendingCommit = null
          do {
            lc()
          } while (0 !== xu)
          if (6 & tu) throw Error(l(327))
          if (null !== t) {
            if (t === e.current) throw Error(l(177))
            if (
              ((a = t.lanes | t.childLanes),
              (function (e, t, n, r, o, a) {
                var l = e.pendingLanes
                ;((e.pendingLanes = n),
                  (e.suspendedLanes = 0),
                  (e.pingedLanes = 0),
                  (e.warmLanes = 0),
                  (e.expiredLanes &= n),
                  (e.entangledLanes &= n),
                  (e.errorRecoveryDisabledLanes &= n),
                  (e.shellSuspendCounter = 0))
                var i = e.entanglements,
                  s = e.expirationTimes,
                  u = e.hiddenUpdates
                for (n = l & ~n; 0 < n; ) {
                  var c = 31 - fe(n),
                    d = 1 << c
                  ;((i[c] = 0), (s[c] = -1))
                  var f = u[c]
                  if (null !== f)
                    for (u[c] = null, c = 0; c < f.length; c++) {
                      var p = f[c]
                      null !== p && (p.lane &= -536870913)
                    }
                  n &= ~d
                }
                ;(0 !== r && Pe(e, r, 0),
                  0 !== a && 0 === o && 0 !== e.tag && (e.suspendedLanes |= a & ~(l & ~t)))
              })(e, n, (a |= _r), i, s, u),
              e === nu && ((ru = nu = null), (ou = 0)),
              (_u = t),
              (Pu = e),
              (Cu = n),
              (Eu = a),
              (ju = o),
              (Tu = r),
              10256 & t.subtreeFlags || 10256 & t.flags
                ? ((e.callbackNode = null),
                  (e.callbackPriority = 0),
                  K(oe, function () {
                    return (ic(), null)
                  }))
                : ((e.callbackNode = null), (e.callbackPriority = 0)),
              (r = !!(13878 & t.flags)),
              13878 & t.subtreeFlags || r)
            ) {
              ;((r = M.T), (M.T = null), (o = A.p), (A.p = 2), (i = tu), (tu |= 4))
              try {
                !(function (e, t) {
                  if (((e = e.containerInfo), (ed = Jd), er((e = Jn(e))))) {
                    if ('selectionStart' in e)
                      var n = { start: e.selectionStart, end: e.selectionEnd }
                    else
                      e: {
                        var r =
                          (n = ((n = e.ownerDocument) && n.defaultView) || window).getSelection &&
                          n.getSelection()
                        if (r && 0 !== r.rangeCount) {
                          n = r.anchorNode
                          var o = r.anchorOffset,
                            a = r.focusNode
                          r = r.focusOffset
                          try {
                            ;(n.nodeType, a.nodeType)
                          } catch (e) {
                            n = null
                            break e
                          }
                          var i = 0,
                            s = -1,
                            u = -1,
                            c = 0,
                            d = 0,
                            f = e,
                            p = null
                          t: for (;;) {
                            for (
                              var m;
                              f !== n || (0 !== o && 3 !== f.nodeType) || (s = i + o),
                                f !== a || (0 !== r && 3 !== f.nodeType) || (u = i + r),
                                3 === f.nodeType && (i += f.nodeValue.length),
                                null !== (m = f.firstChild);

                            )
                              ((p = f), (f = m))
                            for (;;) {
                              if (f === e) break t
                              if (
                                (p === n && ++c === o && (s = i),
                                p === a && ++d === r && (u = i),
                                null !== (m = f.nextSibling))
                              )
                                break
                              p = (f = p).parentNode
                            }
                            f = m
                          }
                          n = -1 === s || -1 === u ? null : { start: s, end: u }
                        } else n = null
                      }
                    n = n || { start: 0, end: 0 }
                  } else n = null
                  for (td = { focusedElem: e, selectionRange: n }, Jd = !1, Os = t; null !== Os; )
                    if (((e = (t = Os).child), 1024 & t.subtreeFlags && null !== e))
                      ((e.return = t), (Os = e))
                    else
                      for (; null !== Os; ) {
                        switch (((a = (t = Os).alternate), (e = t.flags), t.tag)) {
                          case 0:
                          case 11:
                          case 15:
                          case 5:
                          case 26:
                          case 27:
                          case 6:
                          case 4:
                          case 17:
                            break
                          case 1:
                            if (1024 & e && null !== a) {
                              ;((e = void 0),
                                (n = t),
                                (o = a.memoizedProps),
                                (a = a.memoizedState),
                                (r = n.stateNode))
                              try {
                                var b = bi(n.type, o, (n.elementType, n.type))
                                ;((e = r.getSnapshotBeforeUpdate(b, a)),
                                  (r.__reactInternalSnapshotBeforeUpdate = e))
                              } catch (e) {
                                uc(n, n.return, e)
                              }
                            }
                            break
                          case 3:
                            if (1024 & e)
                              if (9 === (n = (e = t.stateNode.containerInfo).nodeType)) md(e)
                              else if (1 === n)
                                switch (e.nodeName) {
                                  case 'HEAD':
                                  case 'HTML':
                                  case 'BODY':
                                    md(e)
                                    break
                                  default:
                                    e.textContent = ''
                                }
                            break
                          default:
                            if (1024 & e) throw Error(l(163))
                        }
                        if (null !== (e = t.sibling)) {
                          ;((e.return = t.return), (Os = e))
                          break
                        }
                        Os = t.return
                      }
                })(e, t)
              } finally {
                ;((tu = i), (A.p = o), (M.T = r))
              }
            }
            ;((xu = 1), nc(), rc(), oc())
          }
        }
        function nc() {
          if (1 === xu) {
            xu = 0
            var e = Pu,
              t = _u,
              n = !!(13878 & t.flags)
            if (13878 & t.subtreeFlags || n) {
              ;((n = M.T), (M.T = null))
              var r = A.p
              A.p = 2
              var o = tu
              tu |= 4
              try {
                Ms(t, e)
                var a = td,
                  l = Jn(e.containerInfo),
                  i = a.focusedElem,
                  s = a.selectionRange
                if (l !== i && i && i.ownerDocument && Zn(i.ownerDocument.documentElement, i)) {
                  if (null !== s && er(i)) {
                    var u = s.start,
                      c = s.end
                    if ((void 0 === c && (c = u), 'selectionStart' in i))
                      ((i.selectionStart = u), (i.selectionEnd = Math.min(c, i.value.length)))
                    else {
                      var d = i.ownerDocument || document,
                        f = (d && d.defaultView) || window
                      if (f.getSelection) {
                        var p = f.getSelection(),
                          m = i.textContent.length,
                          b = Math.min(s.start, m),
                          h = void 0 === s.end ? b : Math.min(s.end, m)
                        !p.extend && b > h && ((l = h), (h = b), (b = l))
                        var g = Qn(i, b),
                          y = Qn(i, h)
                        if (
                          g &&
                          y &&
                          (1 !== p.rangeCount ||
                            p.anchorNode !== g.node ||
                            p.anchorOffset !== g.offset ||
                            p.focusNode !== y.node ||
                            p.focusOffset !== y.offset)
                        ) {
                          var v = d.createRange()
                          ;(v.setStart(g.node, g.offset),
                            p.removeAllRanges(),
                            b > h
                              ? (p.addRange(v), p.extend(y.node, y.offset))
                              : (v.setEnd(y.node, y.offset), p.addRange(v)))
                        }
                      }
                    }
                  }
                  for (d = [], p = i; (p = p.parentNode); )
                    1 === p.nodeType && d.push({ element: p, left: p.scrollLeft, top: p.scrollTop })
                  for ('function' == typeof i.focus && i.focus(), i = 0; i < d.length; i++) {
                    var S = d[i]
                    ;((S.element.scrollLeft = S.left), (S.element.scrollTop = S.top))
                  }
                }
                ;((Jd = !!ed), (td = ed = null))
              } finally {
                ;((tu = o), (A.p = r), (M.T = n))
              }
            }
            ;((e.current = t), (xu = 2))
          }
        }
        function rc() {
          if (2 === xu) {
            xu = 0
            var e = Pu,
              t = _u,
              n = !!(8772 & t.flags)
            if (8772 & t.subtreeFlags || n) {
              ;((n = M.T), (M.T = null))
              var r = A.p
              A.p = 2
              var o = tu
              tu |= 4
              try {
                ks(e, t.alternate, t)
              } finally {
                ;((tu = o), (A.p = r), (M.T = n))
              }
            }
            xu = 3
          }
        }
        function oc() {
          if (4 === xu || 3 === xu) {
            ;((xu = 0), J())
            var e = Pu,
              t = _u,
              n = Cu,
              r = Tu
            10256 & t.subtreeFlags || 10256 & t.flags
              ? (xu = 5)
              : ((xu = 0), (_u = Pu = null), ac(e, e.pendingLanes))
            var o = e.pendingLanes
            if (
              (0 === o && (ku = null),
              Ee(n),
              (t = t.stateNode),
              ce && 'function' == typeof ce.onCommitFiberRoot)
            )
              try {
                ce.onCommitFiberRoot(ue, t, void 0, !(128 & ~t.current.flags))
              } catch (e) {}
            if (null !== r) {
              ;((t = M.T), (o = A.p), (A.p = 2), (M.T = null))
              try {
                for (var a = e.onRecoverableError, l = 0; l < r.length; l++) {
                  var i = r[l]
                  a(i.value, { componentStack: i.stack })
                }
              } finally {
                ;((M.T = t), (A.p = o))
              }
            }
            ;(3 & Cu && lc(),
              wc(e),
              (o = e.pendingLanes),
              4194090 & n && 42 & o ? (e === Nu ? Ru++ : ((Ru = 0), (Nu = e))) : (Ru = 0),
              Oc(0, !1))
          }
        }
        function ac(e, t) {
          0 == (e.pooledCacheLanes &= t) &&
            null != (t = e.pooledCache) &&
            ((e.pooledCache = null), Ao(t))
        }
        function lc(e) {
          return (nc(), rc(), oc(), ic())
        }
        function ic() {
          if (5 !== xu) return !1
          var e = Pu,
            t = Eu
          Eu = 0
          var n = Ee(Cu),
            r = M.T,
            o = A.p
          try {
            ;((A.p = 32 > n ? 32 : n), (M.T = null), (n = ju), (ju = null))
            var a = Pu,
              i = Cu
            if (((xu = 0), (_u = Pu = null), (Cu = 0), 6 & tu)) throw Error(l(331))
            var s = tu
            if (
              ((tu |= 4),
              Ks(a.current),
              Ws(a, a.current, i, n),
              (tu = s),
              Oc(0, !1),
              ce && 'function' == typeof ce.onPostCommitFiberRoot)
            )
              try {
                ce.onPostCommitFiberRoot(ue, a)
              } catch (e) {}
            return !0
          } finally {
            ;((A.p = o), (M.T = r), ac(e, t))
          }
        }
        function sc(e, t, n) {
          ;((t = kr(n, t)),
            null !== (e = aa(e, (t = Oi(e.stateNode, t, 2)), 2)) && (xe(e, 2), wc(e)))
        }
        function uc(e, t, n) {
          if (3 === e.tag) sc(e, e, n)
          else
            for (; null !== t; ) {
              if (3 === t.tag) {
                sc(t, e, n)
                break
              }
              if (1 === t.tag) {
                var r = t.stateNode
                if (
                  'function' == typeof t.type.getDerivedStateFromError ||
                  ('function' == typeof r.componentDidCatch && (null === ku || !ku.has(r)))
                ) {
                  ;((e = kr(n, e)),
                    null !== (r = aa(t, (n = ki(2)), 2)) && (xi(n, r, t, e), xe(r, 2), wc(r)))
                  break
                }
              }
              t = t.return
            }
        }
        function cc(e, t, n) {
          var r = e.pingCache
          if (null === r) {
            r = e.pingCache = new eu()
            var o = new Set()
            r.set(t, o)
          } else void 0 === (o = r.get(t)) && ((o = new Set()), r.set(t, o))
          o.has(n) || ((uu = !0), o.add(n), (e = dc.bind(null, e, t, n)), t.then(e, e))
        }
        function dc(e, t, n) {
          var r = e.pingCache
          ;(null !== r && r.delete(t),
            (e.pingedLanes |= e.suspendedLanes & n),
            (e.warmLanes &= ~n),
            nu === e &&
              (ou & n) === n &&
              (4 === du || (3 === du && (62914560 & ou) === ou && 300 > ee() - Su)
                ? !(2 & tu) && Wu(e, 0)
                : (mu |= n),
              hu === ou && (hu = 0)),
            wc(e))
        }
        function fc(e, t) {
          ;(0 === t && (t = Oe()), null !== (e = Tr(e, t)) && (xe(e, t), wc(e)))
        }
        function pc(e) {
          var t = e.memoizedState,
            n = 0
          ;(null !== t && (n = t.retryLane), fc(e, n))
        }
        function mc(e, t) {
          var n = 0
          switch (e.tag) {
            case 13:
              var r = e.stateNode,
                o = e.memoizedState
              null !== o && (n = o.retryLane)
              break
            case 19:
              r = e.stateNode
              break
            case 22:
              r = e.stateNode._retryCache
              break
            default:
              throw Error(l(314))
          }
          ;(null !== r && r.delete(t), fc(e, n))
        }
        var bc = null,
          hc = null,
          gc = !1,
          yc = !1,
          vc = !1,
          Sc = 0
        function wc(e) {
          ;(e !== hc && null === e.next && (null === hc ? (bc = hc = e) : (hc = hc.next = e)),
            (yc = !0),
            gc ||
              ((gc = !0),
              cd(function () {
                6 & tu ? K(ne, kc) : xc()
              })))
        }
        function Oc(e, t) {
          if (!vc && yc) {
            vc = !0
            do {
              for (var n = !1, r = bc; null !== r; ) {
                if (!t)
                  if (0 !== e) {
                    var o = r.pendingLanes
                    if (0 === o) var a = 0
                    else {
                      var l = r.suspendedLanes,
                        i = r.pingedLanes
                      ;((a = (1 << (31 - fe(42 | e) + 1)) - 1),
                        (a =
                          201326741 & (a &= o & ~(l & ~i)) ? (201326741 & a) | 1 : a ? 2 | a : 0))
                    }
                    0 !== a && ((n = !0), Cc(r, a))
                  } else
                    ((a = ou),
                      !(
                        3 &
                        (a = ye(
                          r,
                          r === nu ? a : 0,
                          null !== r.cancelPendingCommit || -1 !== r.timeoutHandle
                        ))
                      ) ||
                        ve(r, a) ||
                        ((n = !0), Cc(r, a)))
                r = r.next
              }
            } while (n)
            vc = !1
          }
        }
        function kc() {
          xc()
        }
        function xc() {
          yc = gc = !1
          var e,
            t = 0
          0 !== Sc &&
            (((e = window.event) && 'popstate' === e.type
              ? e !== ld && ((ld = e), !0)
              : ((ld = null), !1)) && (t = Sc),
            (Sc = 0))
          for (var n = ee(), r = null, o = bc; null !== o; ) {
            var a = o.next,
              l = Pc(o, n)
            ;(0 === l
              ? ((o.next = null), null === r ? (bc = a) : (r.next = a), null === a && (hc = r))
              : ((r = o), (0 !== t || 3 & l) && (yc = !0)),
              (o = a))
          }
          Oc(t, !1)
        }
        function Pc(e, t) {
          for (
            var n = e.suspendedLanes,
              r = e.pingedLanes,
              o = e.expirationTimes,
              a = -62914561 & e.pendingLanes;
            0 < a;

          ) {
            var l = 31 - fe(a),
              i = 1 << l,
              s = o[l]
            ;(-1 === s ? (i & n && !(i & r)) || (o[l] = Se(i, t)) : s <= t && (e.expiredLanes |= i),
              (a &= ~i))
          }
          if (
            ((n = ou),
            (n = ye(
              e,
              e === (t = nu) ? n : 0,
              null !== e.cancelPendingCommit || -1 !== e.timeoutHandle
            )),
            (r = e.callbackNode),
            0 === n || (e === t && (2 === au || 9 === au)) || null !== e.cancelPendingCommit)
          )
            return (
              null !== r && null !== r && Q(r),
              (e.callbackNode = null),
              (e.callbackPriority = 0)
            )
          if (!(3 & n) || ve(e, n)) {
            if ((t = n & -n) === e.callbackPriority) return t
            switch ((null !== r && Q(r), Ee(n))) {
              case 2:
              case 8:
                n = re
                break
              case 32:
              default:
                n = oe
                break
              case 268435456:
                n = le
            }
            return (
              (r = _c.bind(null, e)),
              (n = K(n, r)),
              (e.callbackPriority = t),
              (e.callbackNode = n),
              t
            )
          }
          return (
            null !== r && null !== r && Q(r),
            (e.callbackPriority = 2),
            (e.callbackNode = null),
            2
          )
        }
        function _c(e, t) {
          if (0 !== xu && 5 !== xu) return ((e.callbackNode = null), (e.callbackPriority = 0), null)
          var n = e.callbackNode
          if (lc() && e.callbackNode !== n) return null
          var r = ou
          return 0 ===
            (r = ye(e, e === nu ? r : 0, null !== e.cancelPendingCommit || -1 !== e.timeoutHandle))
            ? null
            : (zu(e, r, t),
              Pc(e, ee()),
              null != e.callbackNode && e.callbackNode === n ? _c.bind(null, e) : null)
        }
        function Cc(e, t) {
          if (lc()) return null
          zu(e, t, !0)
        }
        function Ec() {
          return (0 === Sc && (Sc = we()), Sc)
        }
        function jc(e) {
          return null == e || 'symbol' == typeof e || 'boolean' == typeof e
            ? null
            : 'function' == typeof e
              ? e
              : Et('' + e)
        }
        function Tc(e, t) {
          var n = t.ownerDocument.createElement('input')
          return (
            (n.name = t.name),
            (n.value = t.value),
            e.id && n.setAttribute('form', e.id),
            t.parentNode.insertBefore(n, t),
            (e = new FormData(e)),
            n.parentNode.removeChild(n),
            e
          )
        }
        for (var Rc = 0; Rc < Sr.length; Rc++) {
          var Nc = Sr[Rc]
          wr(Nc.toLowerCase(), 'on' + (Nc[0].toUpperCase() + Nc.slice(1)))
        }
        ;(wr(fr, 'onAnimationEnd'),
          wr(pr, 'onAnimationIteration'),
          wr(mr, 'onAnimationStart'),
          wr('dblclick', 'onDoubleClick'),
          wr('focusin', 'onFocus'),
          wr('focusout', 'onBlur'),
          wr(br, 'onTransitionRun'),
          wr(hr, 'onTransitionStart'),
          wr(gr, 'onTransitionCancel'),
          wr(yr, 'onTransitionEnd'),
          Xe('onMouseEnter', ['mouseout', 'mouseover']),
          Xe('onMouseLeave', ['mouseout', 'mouseover']),
          Xe('onPointerEnter', ['pointerout', 'pointerover']),
          Xe('onPointerLeave', ['pointerout', 'pointerover']),
          qe(
            'onChange',
            'change click focusin focusout input keydown keyup selectionchange'.split(' ')
          ),
          qe(
            'onSelect',
            'focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange'.split(
              ' '
            )
          ),
          qe('onBeforeInput', ['compositionend', 'keypress', 'textInput', 'paste']),
          qe(
            'onCompositionEnd',
            'compositionend focusout keydown keypress keyup mousedown'.split(' ')
          ),
          qe(
            'onCompositionStart',
            'compositionstart focusout keydown keypress keyup mousedown'.split(' ')
          ),
          qe(
            'onCompositionUpdate',
            'compositionupdate focusout keydown keypress keyup mousedown'.split(' ')
          ))
        var Mc =
            'abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting'.split(
              ' '
            ),
          Ac = new Set(
            'beforetoggle cancel close invalid load scroll scrollend toggle'.split(' ').concat(Mc)
          )
        function Dc(e, t) {
          t = !!(4 & t)
          for (var n = 0; n < e.length; n++) {
            var r = e[n],
              o = r.event
            r = r.listeners
            e: {
              var a = void 0
              if (t)
                for (var l = r.length - 1; 0 <= l; l--) {
                  var i = r[l],
                    s = i.instance,
                    u = i.currentTarget
                  if (((i = i.listener), s !== a && o.isPropagationStopped())) break e
                  ;((a = i), (o.currentTarget = u))
                  try {
                    a(o)
                  } catch (e) {
                    hi(e)
                  }
                  ;((o.currentTarget = null), (a = s))
                }
              else
                for (l = 0; l < r.length; l++) {
                  if (
                    ((s = (i = r[l]).instance),
                    (u = i.currentTarget),
                    (i = i.listener),
                    s !== a && o.isPropagationStopped())
                  )
                    break e
                  ;((a = i), (o.currentTarget = u))
                  try {
                    a(o)
                  } catch (e) {
                    hi(e)
                  }
                  ;((o.currentTarget = null), (a = s))
                }
            }
          }
        }
        function zc(e, t) {
          var n = t[Ae]
          void 0 === n && (n = t[Ae] = new Set())
          var r = e + '__bubble'
          n.has(r) || (Fc(t, e, 2, !1), n.add(r))
        }
        function Ic(e, t, n) {
          var r = 0
          ;(t && (r |= 4), Fc(n, e, r, t))
        }
        var $c = '_reactListening' + Math.random().toString(36).slice(2)
        function Lc(e) {
          if (!e[$c]) {
            ;((e[$c] = !0),
              Ue.forEach(function (t) {
                'selectionchange' !== t && (Ac.has(t) || Ic(t, !1, e), Ic(t, !0, e))
              }))
            var t = 9 === e.nodeType ? e : e.ownerDocument
            null === t || t[$c] || ((t[$c] = !0), Ic('selectionchange', !1, t))
          }
        }
        function Fc(e, t, n, r) {
          switch (lf(t)) {
            case 2:
              var o = ef
              break
            case 8:
              o = tf
              break
            default:
              o = nf
          }
          ;((n = o.bind(null, t, n, e)),
            (o = void 0),
            !$t || ('touchstart' !== t && 'touchmove' !== t && 'wheel' !== t) || (o = !0),
            r
              ? void 0 !== o
                ? e.addEventListener(t, n, { capture: !0, passive: o })
                : e.addEventListener(t, n, !0)
              : void 0 !== o
                ? e.addEventListener(t, n, { passive: o })
                : e.addEventListener(t, n, !1))
        }
        function Vc(e, t, n, r, o) {
          var a = r
          if (!(1 & t || 2 & t || null === r))
            e: for (;;) {
              if (null === r) return
              var l = r.tag
              if (3 === l || 4 === l) {
                var s = r.stateNode.containerInfo
                if (s === o) break
                if (4 === l)
                  for (l = r.return; null !== l; ) {
                    var u = l.tag
                    if ((3 === u || 4 === u) && l.stateNode.containerInfo === o) return
                    l = l.return
                  }
                for (; null !== s; ) {
                  if (null === (l = Fe(s))) return
                  if (5 === (u = l.tag) || 6 === u || 26 === u || 27 === u) {
                    r = a = l
                    continue e
                  }
                  s = s.parentNode
                }
              }
              r = r.return
            }
          Dt(function () {
            var r = a,
              o = Tt(n),
              l = []
            e: {
              var s = vr.get(e)
              if (void 0 !== s) {
                var u = Zt,
                  c = e
                switch (e) {
                  case 'keypress':
                    if (0 === Ht(n)) break e
                  case 'keydown':
                  case 'keyup':
                    u = mn
                    break
                  case 'focusin':
                    ;((c = 'focus'), (u = on))
                    break
                  case 'focusout':
                    ;((c = 'blur'), (u = on))
                    break
                  case 'beforeblur':
                  case 'afterblur':
                    u = on
                    break
                  case 'click':
                    if (2 === n.button) break e
                  case 'auxclick':
                  case 'dblclick':
                  case 'mousedown':
                  case 'mousemove':
                  case 'mouseup':
                  case 'mouseout':
                  case 'mouseover':
                  case 'contextmenu':
                    u = nn
                    break
                  case 'drag':
                  case 'dragend':
                  case 'dragenter':
                  case 'dragexit':
                  case 'dragleave':
                  case 'dragover':
                  case 'dragstart':
                  case 'drop':
                    u = rn
                    break
                  case 'touchcancel':
                  case 'touchend':
                  case 'touchmove':
                  case 'touchstart':
                    u = hn
                    break
                  case fr:
                  case pr:
                  case mr:
                    u = an
                    break
                  case yr:
                    u = gn
                    break
                  case 'scroll':
                  case 'scrollend':
                    u = en
                    break
                  case 'wheel':
                    u = yn
                    break
                  case 'copy':
                  case 'cut':
                  case 'paste':
                    u = ln
                    break
                  case 'gotpointercapture':
                  case 'lostpointercapture':
                  case 'pointercancel':
                  case 'pointerdown':
                  case 'pointermove':
                  case 'pointerout':
                  case 'pointerover':
                  case 'pointerup':
                    u = bn
                    break
                  case 'toggle':
                  case 'beforetoggle':
                    u = vn
                }
                var d = !!(4 & t),
                  f = !d && ('scroll' === e || 'scrollend' === e),
                  p = d ? (null !== s ? s + 'Capture' : null) : s
                d = []
                for (var m, b = r; null !== b; ) {
                  var h = b
                  if (
                    ((m = h.stateNode),
                    (5 !== (h = h.tag) && 26 !== h && 27 !== h) ||
                      null === m ||
                      null === p ||
                      (null != (h = zt(b, p)) && d.push(Wc(b, h, m))),
                    f)
                  )
                    break
                  b = b.return
                }
                0 < d.length && ((s = new u(s, c, null, n, o)), l.push({ event: s, listeners: d }))
              }
            }
            if (!(7 & t)) {
              if (
                ((u = 'mouseout' === e || 'pointerout' === e),
                (!(s = 'mouseover' === e || 'pointerover' === e) ||
                  n === jt ||
                  !(c = n.relatedTarget || n.fromElement) ||
                  (!Fe(c) && !c[Me])) &&
                  (u || s) &&
                  ((s =
                    o.window === o
                      ? o
                      : (s = o.ownerDocument)
                        ? s.defaultView || s.parentWindow
                        : window),
                  u
                    ? ((u = r),
                      null !== (c = (c = n.relatedTarget || n.toElement) ? Fe(c) : null) &&
                        ((f = i(c)), (d = c.tag), c !== f || (5 !== d && 27 !== d && 6 !== d)) &&
                        (c = null))
                    : ((u = null), (c = r)),
                  u !== c))
              ) {
                if (
                  ((d = nn),
                  (h = 'onMouseLeave'),
                  (p = 'onMouseEnter'),
                  (b = 'mouse'),
                  ('pointerout' !== e && 'pointerover' !== e) ||
                    ((d = bn), (h = 'onPointerLeave'), (p = 'onPointerEnter'), (b = 'pointer')),
                  (f = null == u ? s : We(u)),
                  (m = null == c ? s : We(c)),
                  ((s = new d(h, b + 'leave', u, n, o)).target = f),
                  (s.relatedTarget = m),
                  (h = null),
                  Fe(o) === r &&
                    (((d = new d(p, b + 'enter', c, n, o)).target = m),
                    (d.relatedTarget = f),
                    (h = d)),
                  (f = h),
                  u && c)
                )
                  e: {
                    for (p = c, b = 0, m = d = u; m; m = Hc(m)) b++
                    for (m = 0, h = p; h; h = Hc(h)) m++
                    for (; 0 < b - m; ) ((d = Hc(d)), b--)
                    for (; 0 < m - b; ) ((p = Hc(p)), m--)
                    for (; b--; ) {
                      if (d === p || (null !== p && d === p.alternate)) break e
                      ;((d = Hc(d)), (p = Hc(p)))
                    }
                    d = null
                  }
                else d = null
                ;(null !== u && Uc(l, s, u, d, !1), null !== c && null !== f && Uc(l, f, c, d, !0))
              }
              if (
                'select' === (u = (s = r ? We(r) : window).nodeName && s.nodeName.toLowerCase()) ||
                ('input' === u && 'file' === s.type)
              )
                var g = In
              else if (Rn(s))
                if ($n) g = qn
                else {
                  g = Un
                  var y = Hn
                }
              else
                !(u = s.nodeName) ||
                'input' !== u.toLowerCase() ||
                ('checkbox' !== s.type && 'radio' !== s.type)
                  ? r && Pt(r.elementType) && (g = In)
                  : (g = Gn)
              switch (
                (g && (g = g(e, r))
                  ? Nn(l, g, n, o)
                  : (y && y(e, s, r),
                    'focusout' === e &&
                      r &&
                      'number' === s.type &&
                      null != r.memoizedProps.value &&
                      gt(s, 'number', s.value)),
                (y = r ? We(r) : window),
                e)
              ) {
                case 'focusin':
                  ;(Rn(y) || 'true' === y.contentEditable) && ((nr = y), (rr = r), (or = null))
                  break
                case 'focusout':
                  or = rr = nr = null
                  break
                case 'mousedown':
                  ar = !0
                  break
                case 'contextmenu':
                case 'mouseup':
                case 'dragend':
                  ;((ar = !1), lr(l, n, o))
                  break
                case 'selectionchange':
                  if (tr) break
                case 'keydown':
                case 'keyup':
                  lr(l, n, o)
              }
              var v
              if (wn)
                e: {
                  switch (e) {
                    case 'compositionstart':
                      var S = 'onCompositionStart'
                      break e
                    case 'compositionend':
                      S = 'onCompositionEnd'
                      break e
                    case 'compositionupdate':
                      S = 'onCompositionUpdate'
                      break e
                  }
                  S = void 0
                }
              else
                jn
                  ? Cn(e, n) && (S = 'onCompositionEnd')
                  : 'keydown' === e && 229 === n.keyCode && (S = 'onCompositionStart')
              ;(S &&
                (xn &&
                  'ko' !== n.locale &&
                  (jn || 'onCompositionStart' !== S
                    ? 'onCompositionEnd' === S && jn && (v = Bt())
                    : ((Vt = 'value' in (Ft = o) ? Ft.value : Ft.textContent), (jn = !0))),
                0 < (y = Bc(r, S)).length &&
                  ((S = new sn(S, e, null, n, o)),
                  l.push({ event: S, listeners: y }),
                  (v || null !== (v = En(n))) && (S.data = v))),
                (v = kn
                  ? (function (e, t) {
                      switch (e) {
                        case 'compositionend':
                          return En(t)
                        case 'keypress':
                          return 32 !== t.which ? null : ((_n = !0), Pn)
                        case 'textInput':
                          return (e = t.data) === Pn && _n ? null : e
                        default:
                          return null
                      }
                    })(e, n)
                  : (function (e, t) {
                      if (jn)
                        return 'compositionend' === e || (!wn && Cn(e, t))
                          ? ((e = Bt()), (Wt = Vt = Ft = null), (jn = !1), e)
                          : null
                      switch (e) {
                        case 'paste':
                        default:
                          return null
                        case 'keypress':
                          if (!(t.ctrlKey || t.altKey || t.metaKey) || (t.ctrlKey && t.altKey)) {
                            if (t.char && 1 < t.char.length) return t.char
                            if (t.which) return String.fromCharCode(t.which)
                          }
                          return null
                        case 'compositionend':
                          return xn && 'ko' !== t.locale ? null : t.data
                      }
                    })(e, n)) &&
                  0 < (S = Bc(r, 'onBeforeInput')).length &&
                  ((y = new sn('onBeforeInput', 'beforeinput', null, n, o)),
                  l.push({ event: y, listeners: S }),
                  (y.data = v)),
                (function (e, t, n, r, o) {
                  if ('submit' === t && n && n.stateNode === o) {
                    var a = jc((o[Ne] || null).action),
                      l = r.submitter
                    l &&
                      null !==
                        (t = (t = l[Ne] || null)
                          ? jc(t.formAction)
                          : l.getAttribute('formAction')) &&
                      ((a = t), (l = null))
                    var i = new Zt('action', 'action', null, r, o)
                    e.push({
                      event: i,
                      listeners: [
                        {
                          instance: null,
                          listener: function () {
                            if (r.defaultPrevented) {
                              if (0 !== Sc) {
                                var e = l ? Tc(o, l) : new FormData(o)
                                Tl(
                                  n,
                                  { pending: !0, data: e, method: o.method, action: a },
                                  null,
                                  e
                                )
                              }
                            } else
                              'function' == typeof a &&
                                (i.preventDefault(),
                                (e = l ? Tc(o, l) : new FormData(o)),
                                Tl(n, { pending: !0, data: e, method: o.method, action: a }, a, e))
                          },
                          currentTarget: o,
                        },
                      ],
                    })
                  }
                })(l, e, r, n, o))
            }
            Dc(l, t)
          })
        }
        function Wc(e, t, n) {
          return { instance: e, listener: t, currentTarget: n }
        }
        function Bc(e, t) {
          for (var n = t + 'Capture', r = []; null !== e; ) {
            var o = e,
              a = o.stateNode
            if (
              ((5 !== (o = o.tag) && 26 !== o && 27 !== o) ||
                null === a ||
                (null != (o = zt(e, n)) && r.unshift(Wc(e, o, a)),
                null != (o = zt(e, t)) && r.push(Wc(e, o, a))),
              3 === e.tag)
            )
              return r
            e = e.return
          }
          return []
        }
        function Hc(e) {
          if (null === e) return null
          do {
            e = e.return
          } while (e && 5 !== e.tag && 27 !== e.tag)
          return e || null
        }
        function Uc(e, t, n, r, o) {
          for (var a = t._reactName, l = []; null !== n && n !== r; ) {
            var i = n,
              s = i.alternate,
              u = i.stateNode
            if (((i = i.tag), null !== s && s === r)) break
            ;((5 !== i && 26 !== i && 27 !== i) ||
              null === u ||
              ((s = u),
              o
                ? null != (u = zt(n, a)) && l.unshift(Wc(n, u, s))
                : o || (null != (u = zt(n, a)) && l.push(Wc(n, u, s)))),
              (n = n.return))
          }
          0 !== l.length && e.push({ event: t, listeners: l })
        }
        var Gc = /\r\n?/g,
          qc = /\u0000|\uFFFD/g
        function Xc(e) {
          return ('string' == typeof e ? e : '' + e).replace(Gc, '\n').replace(qc, '')
        }
        function Yc(e, t) {
          return ((t = Xc(t)), Xc(e) === t)
        }
        function Kc() {}
        function Qc(e, t, n, r, o, a) {
          switch (n) {
            case 'children':
              'string' == typeof r
                ? 'body' === t || ('textarea' === t && '' === r) || wt(e, r)
                : ('number' == typeof r || 'bigint' == typeof r) && 'body' !== t && wt(e, '' + r)
              break
            case 'className':
              tt(e, 'class', r)
              break
            case 'tabIndex':
              tt(e, 'tabindex', r)
              break
            case 'dir':
            case 'role':
            case 'viewBox':
            case 'width':
            case 'height':
              tt(e, n, r)
              break
            case 'style':
              xt(e, r, a)
              break
            case 'data':
              if ('object' !== t) {
                tt(e, 'data', r)
                break
              }
            case 'src':
            case 'href':
              if ('' === r && ('a' !== t || 'href' !== n)) {
                e.removeAttribute(n)
                break
              }
              if (
                null == r ||
                'function' == typeof r ||
                'symbol' == typeof r ||
                'boolean' == typeof r
              ) {
                e.removeAttribute(n)
                break
              }
              ;((r = Et('' + r)), e.setAttribute(n, r))
              break
            case 'action':
            case 'formAction':
              if ('function' == typeof r) {
                e.setAttribute(
                  n,
                  "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
                )
                break
              }
              if (
                ('function' == typeof a &&
                  ('formAction' === n
                    ? ('input' !== t && Qc(e, t, 'name', o.name, o, null),
                      Qc(e, t, 'formEncType', o.formEncType, o, null),
                      Qc(e, t, 'formMethod', o.formMethod, o, null),
                      Qc(e, t, 'formTarget', o.formTarget, o, null))
                    : (Qc(e, t, 'encType', o.encType, o, null),
                      Qc(e, t, 'method', o.method, o, null),
                      Qc(e, t, 'target', o.target, o, null))),
                null == r || 'symbol' == typeof r || 'boolean' == typeof r)
              ) {
                e.removeAttribute(n)
                break
              }
              ;((r = Et('' + r)), e.setAttribute(n, r))
              break
            case 'onClick':
              null != r && (e.onclick = Kc)
              break
            case 'onScroll':
              null != r && zc('scroll', e)
              break
            case 'onScrollEnd':
              null != r && zc('scrollend', e)
              break
            case 'dangerouslySetInnerHTML':
              if (null != r) {
                if ('object' != typeof r || !('__html' in r)) throw Error(l(61))
                if (null != (n = r.__html)) {
                  if (null != o.children) throw Error(l(60))
                  e.innerHTML = n
                }
              }
              break
            case 'multiple':
              e.multiple = r && 'function' != typeof r && 'symbol' != typeof r
              break
            case 'muted':
              e.muted = r && 'function' != typeof r && 'symbol' != typeof r
              break
            case 'suppressContentEditableWarning':
            case 'suppressHydrationWarning':
            case 'defaultValue':
            case 'defaultChecked':
            case 'innerHTML':
            case 'ref':
            case 'autoFocus':
              break
            case 'xlinkHref':
              if (
                null == r ||
                'function' == typeof r ||
                'boolean' == typeof r ||
                'symbol' == typeof r
              ) {
                e.removeAttribute('xlink:href')
                break
              }
              ;((n = Et('' + r)), e.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', n))
              break
            case 'contentEditable':
            case 'spellCheck':
            case 'draggable':
            case 'value':
            case 'autoReverse':
            case 'externalResourcesRequired':
            case 'focusable':
            case 'preserveAlpha':
              null != r && 'function' != typeof r && 'symbol' != typeof r
                ? e.setAttribute(n, '' + r)
                : e.removeAttribute(n)
              break
            case 'inert':
            case 'allowFullScreen':
            case 'async':
            case 'autoPlay':
            case 'controls':
            case 'default':
            case 'defer':
            case 'disabled':
            case 'disablePictureInPicture':
            case 'disableRemotePlayback':
            case 'formNoValidate':
            case 'hidden':
            case 'loop':
            case 'noModule':
            case 'noValidate':
            case 'open':
            case 'playsInline':
            case 'readOnly':
            case 'required':
            case 'reversed':
            case 'scoped':
            case 'seamless':
            case 'itemScope':
              r && 'function' != typeof r && 'symbol' != typeof r
                ? e.setAttribute(n, '')
                : e.removeAttribute(n)
              break
            case 'capture':
            case 'download':
              !0 === r
                ? e.setAttribute(n, '')
                : !1 !== r && null != r && 'function' != typeof r && 'symbol' != typeof r
                  ? e.setAttribute(n, r)
                  : e.removeAttribute(n)
              break
            case 'cols':
            case 'rows':
            case 'size':
            case 'span':
              null != r && 'function' != typeof r && 'symbol' != typeof r && !isNaN(r) && 1 <= r
                ? e.setAttribute(n, r)
                : e.removeAttribute(n)
              break
            case 'rowSpan':
            case 'start':
              null == r || 'function' == typeof r || 'symbol' == typeof r || isNaN(r)
                ? e.removeAttribute(n)
                : e.setAttribute(n, r)
              break
            case 'popover':
              ;(zc('beforetoggle', e), zc('toggle', e), et(e, 'popover', r))
              break
            case 'xlinkActuate':
              nt(e, 'http://www.w3.org/1999/xlink', 'xlink:actuate', r)
              break
            case 'xlinkArcrole':
              nt(e, 'http://www.w3.org/1999/xlink', 'xlink:arcrole', r)
              break
            case 'xlinkRole':
              nt(e, 'http://www.w3.org/1999/xlink', 'xlink:role', r)
              break
            case 'xlinkShow':
              nt(e, 'http://www.w3.org/1999/xlink', 'xlink:show', r)
              break
            case 'xlinkTitle':
              nt(e, 'http://www.w3.org/1999/xlink', 'xlink:title', r)
              break
            case 'xlinkType':
              nt(e, 'http://www.w3.org/1999/xlink', 'xlink:type', r)
              break
            case 'xmlBase':
              nt(e, 'http://www.w3.org/XML/1998/namespace', 'xml:base', r)
              break
            case 'xmlLang':
              nt(e, 'http://www.w3.org/XML/1998/namespace', 'xml:lang', r)
              break
            case 'xmlSpace':
              nt(e, 'http://www.w3.org/XML/1998/namespace', 'xml:space', r)
              break
            case 'is':
              et(e, 'is', r)
              break
            case 'innerText':
            case 'textContent':
              break
            default:
              ;(!(2 < n.length) ||
                ('o' !== n[0] && 'O' !== n[0]) ||
                ('n' !== n[1] && 'N' !== n[1])) &&
                et(e, (n = _t.get(n) || n), r)
          }
        }
        function Zc(e, t, n, r, o, a) {
          switch (n) {
            case 'style':
              xt(e, r, a)
              break
            case 'dangerouslySetInnerHTML':
              if (null != r) {
                if ('object' != typeof r || !('__html' in r)) throw Error(l(61))
                if (null != (n = r.__html)) {
                  if (null != o.children) throw Error(l(60))
                  e.innerHTML = n
                }
              }
              break
            case 'children':
              'string' == typeof r
                ? wt(e, r)
                : ('number' == typeof r || 'bigint' == typeof r) && wt(e, '' + r)
              break
            case 'onScroll':
              null != r && zc('scroll', e)
              break
            case 'onScrollEnd':
              null != r && zc('scrollend', e)
              break
            case 'onClick':
              null != r && (e.onclick = Kc)
              break
            case 'suppressContentEditableWarning':
            case 'suppressHydrationWarning':
            case 'innerHTML':
            case 'ref':
            case 'innerText':
            case 'textContent':
              break
            default:
              Ge.hasOwnProperty(n) ||
                ('o' !== n[0] ||
                'n' !== n[1] ||
                ((o = n.endsWith('Capture')),
                (t = n.slice(2, o ? n.length - 7 : void 0)),
                'function' == typeof (a = null != (a = e[Ne] || null) ? a[n] : null) &&
                  e.removeEventListener(t, a, o),
                'function' != typeof r)
                  ? n in e
                    ? (e[n] = r)
                    : !0 === r
                      ? e.setAttribute(n, '')
                      : et(e, n, r)
                  : ('function' != typeof a &&
                      null !== a &&
                      (n in e ? (e[n] = null) : e.hasAttribute(n) && e.removeAttribute(n)),
                    e.addEventListener(t, r, o)))
          }
        }
        function Jc(e, t, n) {
          switch (t) {
            case 'div':
            case 'span':
            case 'svg':
            case 'path':
            case 'a':
            case 'g':
            case 'p':
            case 'li':
              break
            case 'img':
              ;(zc('error', e), zc('load', e))
              var r,
                o = !1,
                a = !1
              for (r in n)
                if (n.hasOwnProperty(r)) {
                  var i = n[r]
                  if (null != i)
                    switch (r) {
                      case 'src':
                        o = !0
                        break
                      case 'srcSet':
                        a = !0
                        break
                      case 'children':
                      case 'dangerouslySetInnerHTML':
                        throw Error(l(137, t))
                      default:
                        Qc(e, t, r, i, n, null)
                    }
                }
              return (
                a && Qc(e, t, 'srcSet', n.srcSet, n, null),
                void (o && Qc(e, t, 'src', n.src, n, null))
              )
            case 'input':
              zc('invalid', e)
              var s = (r = i = a = null),
                u = null,
                c = null
              for (o in n)
                if (n.hasOwnProperty(o)) {
                  var d = n[o]
                  if (null != d)
                    switch (o) {
                      case 'name':
                        a = d
                        break
                      case 'type':
                        i = d
                        break
                      case 'checked':
                        u = d
                        break
                      case 'defaultChecked':
                        c = d
                        break
                      case 'value':
                        r = d
                        break
                      case 'defaultValue':
                        s = d
                        break
                      case 'children':
                      case 'dangerouslySetInnerHTML':
                        if (null != d) throw Error(l(137, t))
                        break
                      default:
                        Qc(e, t, o, d, n, null)
                    }
                }
              return (ht(e, r, s, u, c, i, a, !1), void ct(e))
            case 'select':
              for (a in (zc('invalid', e), (o = i = r = null), n))
                if (n.hasOwnProperty(a) && null != (s = n[a]))
                  switch (a) {
                    case 'value':
                      r = s
                      break
                    case 'defaultValue':
                      i = s
                      break
                    case 'multiple':
                      o = s
                    default:
                      Qc(e, t, a, s, n, null)
                  }
              return (
                (t = r),
                (n = i),
                (e.multiple = !!o),
                void (null != t ? yt(e, !!o, t, !1) : null != n && yt(e, !!o, n, !0))
              )
            case 'textarea':
              for (i in (zc('invalid', e), (r = a = o = null), n))
                if (n.hasOwnProperty(i) && null != (s = n[i]))
                  switch (i) {
                    case 'value':
                      o = s
                      break
                    case 'defaultValue':
                      a = s
                      break
                    case 'children':
                      r = s
                      break
                    case 'dangerouslySetInnerHTML':
                      if (null != s) throw Error(l(91))
                      break
                    default:
                      Qc(e, t, i, s, n, null)
                  }
              return (St(e, o, a, r), void ct(e))
            case 'option':
              for (u in n)
                n.hasOwnProperty(u) &&
                  null != (o = n[u]) &&
                  ('selected' === u
                    ? (e.selected = o && 'function' != typeof o && 'symbol' != typeof o)
                    : Qc(e, t, u, o, n, null))
              return
            case 'dialog':
              ;(zc('beforetoggle', e), zc('toggle', e), zc('cancel', e), zc('close', e))
              break
            case 'iframe':
            case 'object':
              zc('load', e)
              break
            case 'video':
            case 'audio':
              for (o = 0; o < Mc.length; o++) zc(Mc[o], e)
              break
            case 'image':
              ;(zc('error', e), zc('load', e))
              break
            case 'details':
              zc('toggle', e)
              break
            case 'embed':
            case 'source':
            case 'link':
              ;(zc('error', e), zc('load', e))
            case 'area':
            case 'base':
            case 'br':
            case 'col':
            case 'hr':
            case 'keygen':
            case 'meta':
            case 'param':
            case 'track':
            case 'wbr':
            case 'menuitem':
              for (c in n)
                if (n.hasOwnProperty(c) && null != (o = n[c]))
                  switch (c) {
                    case 'children':
                    case 'dangerouslySetInnerHTML':
                      throw Error(l(137, t))
                    default:
                      Qc(e, t, c, o, n, null)
                  }
              return
            default:
              if (Pt(t)) {
                for (d in n)
                  n.hasOwnProperty(d) && void 0 !== (o = n[d]) && Zc(e, t, d, o, n, void 0)
                return
              }
          }
          for (s in n) n.hasOwnProperty(s) && null != (o = n[s]) && Qc(e, t, s, o, n, null)
        }
        var ed = null,
          td = null
        function nd(e) {
          return 9 === e.nodeType ? e : e.ownerDocument
        }
        function rd(e) {
          switch (e) {
            case 'http://www.w3.org/2000/svg':
              return 1
            case 'http://www.w3.org/1998/Math/MathML':
              return 2
            default:
              return 0
          }
        }
        function od(e, t) {
          if (0 === e)
            switch (t) {
              case 'svg':
                return 1
              case 'math':
                return 2
              default:
                return 0
            }
          return 1 === e && 'foreignObject' === t ? 0 : e
        }
        function ad(e, t) {
          return (
            'textarea' === e ||
            'noscript' === e ||
            'string' == typeof t.children ||
            'number' == typeof t.children ||
            'bigint' == typeof t.children ||
            ('object' == typeof t.dangerouslySetInnerHTML &&
              null !== t.dangerouslySetInnerHTML &&
              null != t.dangerouslySetInnerHTML.__html)
          )
        }
        var ld = null,
          id = 'function' == typeof setTimeout ? setTimeout : void 0,
          sd = 'function' == typeof clearTimeout ? clearTimeout : void 0,
          ud = 'function' == typeof Promise ? Promise : void 0,
          cd =
            'function' == typeof queueMicrotask
              ? queueMicrotask
              : void 0 !== ud
                ? function (e) {
                    return ud.resolve(null).then(e).catch(dd)
                  }
                : id
        function dd(e) {
          setTimeout(function () {
            throw e
          })
        }
        function fd(e) {
          return 'head' === e
        }
        function pd(e, t) {
          var n = t,
            r = 0,
            o = 0
          do {
            var a = n.nextSibling
            if ((e.removeChild(n), a && 8 === a.nodeType))
              if ('/$' === (n = a.data)) {
                if (0 < r && 8 > r) {
                  n = r
                  var l = e.ownerDocument
                  if ((1 & n && Sd(l.documentElement), 2 & n && Sd(l.body), 4 & n))
                    for (Sd((n = l.head)), l = n.firstChild; l; ) {
                      var i = l.nextSibling,
                        s = l.nodeName
                      ;(l[$e] ||
                        'SCRIPT' === s ||
                        'STYLE' === s ||
                        ('LINK' === s && 'stylesheet' === l.rel.toLowerCase()) ||
                        n.removeChild(l),
                        (l = i))
                    }
                }
                if (0 === o) return (e.removeChild(a), void Pf(t))
                o--
              } else '$' === n || '$?' === n || '$!' === n ? o++ : (r = n.charCodeAt(0) - 48)
            else r = 0
            n = a
          } while (n)
          Pf(t)
        }
        function md(e) {
          var t = e.firstChild
          for (t && 10 === t.nodeType && (t = t.nextSibling); t; ) {
            var n = t
            switch (((t = t.nextSibling), n.nodeName)) {
              case 'HTML':
              case 'HEAD':
              case 'BODY':
                ;(md(n), Le(n))
                continue
              case 'SCRIPT':
              case 'STYLE':
                continue
              case 'LINK':
                if ('stylesheet' === n.rel.toLowerCase()) continue
            }
            e.removeChild(n)
          }
        }
        function bd(e) {
          return '$!' === e.data || ('$?' === e.data && 'complete' === e.ownerDocument.readyState)
        }
        function hd(e) {
          for (; null != e; e = e.nextSibling) {
            var t = e.nodeType
            if (1 === t || 3 === t) break
            if (8 === t) {
              if ('$' === (t = e.data) || '$!' === t || '$?' === t || 'F!' === t || 'F' === t) break
              if ('/$' === t) return null
            }
          }
          return e
        }
        var gd = null
        function yd(e) {
          e = e.previousSibling
          for (var t = 0; e; ) {
            if (8 === e.nodeType) {
              var n = e.data
              if ('$' === n || '$!' === n || '$?' === n) {
                if (0 === t) return e
                t--
              } else '/$' === n && t++
            }
            e = e.previousSibling
          }
          return null
        }
        function vd(e, t, n) {
          switch (((t = nd(n)), e)) {
            case 'html':
              if (!(e = t.documentElement)) throw Error(l(452))
              return e
            case 'head':
              if (!(e = t.head)) throw Error(l(453))
              return e
            case 'body':
              if (!(e = t.body)) throw Error(l(454))
              return e
            default:
              throw Error(l(451))
          }
        }
        function Sd(e) {
          for (var t = e.attributes; t.length; ) e.removeAttributeNode(t[0])
          Le(e)
        }
        var wd = new Map(),
          Od = new Set()
        function kd(e) {
          return 'function' == typeof e.getRootNode
            ? e.getRootNode()
            : 9 === e.nodeType
              ? e
              : e.ownerDocument
        }
        var xd = A.d
        A.d = {
          f: function () {
            var e = xd.f(),
              t = Fu()
            return e || t
          },
          r: function (e) {
            var t = Ve(e)
            null !== t && 5 === t.tag && 'form' === t.type ? Nl(t) : xd.r(e)
          },
          D: function (e) {
            ;(xd.D(e), _d('dns-prefetch', e, null))
          },
          C: function (e, t) {
            ;(xd.C(e, t), _d('preconnect', e, t))
          },
          L: function (e, t, n) {
            xd.L(e, t, n)
            var r = Pd
            if (r && e && t) {
              var o = 'link[rel="preload"][as="' + mt(t) + '"]'
              'image' === t && n && n.imageSrcSet
                ? ((o += '[imagesrcset="' + mt(n.imageSrcSet) + '"]'),
                  'string' == typeof n.imageSizes &&
                    (o += '[imagesizes="' + mt(n.imageSizes) + '"]'))
                : (o += '[href="' + mt(e) + '"]')
              var a = o
              switch (t) {
                case 'style':
                  a = Ed(e)
                  break
                case 'script':
                  a = Rd(e)
              }
              wd.has(a) ||
                ((e = d(
                  { rel: 'preload', href: 'image' === t && n && n.imageSrcSet ? void 0 : e, as: t },
                  n
                )),
                wd.set(a, e),
                null !== r.querySelector(o) ||
                  ('style' === t && r.querySelector(jd(a))) ||
                  ('script' === t && r.querySelector(Nd(a))) ||
                  (Jc((t = r.createElement('link')), 'link', e), He(t), r.head.appendChild(t)))
            }
          },
          m: function (e, t) {
            xd.m(e, t)
            var n = Pd
            if (n && e) {
              var r = t && 'string' == typeof t.as ? t.as : 'script',
                o = 'link[rel="modulepreload"][as="' + mt(r) + '"][href="' + mt(e) + '"]',
                a = o
              switch (r) {
                case 'audioworklet':
                case 'paintworklet':
                case 'serviceworker':
                case 'sharedworker':
                case 'worker':
                case 'script':
                  a = Rd(e)
              }
              if (
                !wd.has(a) &&
                ((e = d({ rel: 'modulepreload', href: e }, t)),
                wd.set(a, e),
                null === n.querySelector(o))
              ) {
                switch (r) {
                  case 'audioworklet':
                  case 'paintworklet':
                  case 'serviceworker':
                  case 'sharedworker':
                  case 'worker':
                  case 'script':
                    if (n.querySelector(Nd(a))) return
                }
                ;(Jc((r = n.createElement('link')), 'link', e), He(r), n.head.appendChild(r))
              }
            }
          },
          X: function (e, t) {
            xd.X(e, t)
            var n = Pd
            if (n && e) {
              var r = Be(n).hoistableScripts,
                o = Rd(e),
                a = r.get(o)
              a ||
                ((a = n.querySelector(Nd(o))) ||
                  ((e = d({ src: e, async: !0 }, t)),
                  (t = wd.get(o)) && zd(e, t),
                  He((a = n.createElement('script'))),
                  Jc(a, 'link', e),
                  n.head.appendChild(a)),
                (a = { type: 'script', instance: a, count: 1, state: null }),
                r.set(o, a))
            }
          },
          S: function (e, t, n) {
            xd.S(e, t, n)
            var r = Pd
            if (r && e) {
              var o = Be(r).hoistableStyles,
                a = Ed(e)
              t = t || 'default'
              var l = o.get(a)
              if (!l) {
                var i = { loading: 0, preload: null }
                if ((l = r.querySelector(jd(a)))) i.loading = 5
                else {
                  ;((e = d({ rel: 'stylesheet', href: e, 'data-precedence': t }, n)),
                    (n = wd.get(a)) && Dd(e, n))
                  var s = (l = r.createElement('link'))
                  ;(He(s),
                    Jc(s, 'link', e),
                    (s._p = new Promise(function (e, t) {
                      ;((s.onload = e), (s.onerror = t))
                    })),
                    s.addEventListener('load', function () {
                      i.loading |= 1
                    }),
                    s.addEventListener('error', function () {
                      i.loading |= 2
                    }),
                    (i.loading |= 4),
                    Ad(l, t, r))
                }
                ;((l = { type: 'stylesheet', instance: l, count: 1, state: i }), o.set(a, l))
              }
            }
          },
          M: function (e, t) {
            xd.M(e, t)
            var n = Pd
            if (n && e) {
              var r = Be(n).hoistableScripts,
                o = Rd(e),
                a = r.get(o)
              a ||
                ((a = n.querySelector(Nd(o))) ||
                  ((e = d({ src: e, async: !0, type: 'module' }, t)),
                  (t = wd.get(o)) && zd(e, t),
                  He((a = n.createElement('script'))),
                  Jc(a, 'link', e),
                  n.head.appendChild(a)),
                (a = { type: 'script', instance: a, count: 1, state: null }),
                r.set(o, a))
            }
          },
        }
        var Pd = 'undefined' == typeof document ? null : document
        function _d(e, t, n) {
          var r = Pd
          if (r && 'string' == typeof t && t) {
            var o = mt(t)
            ;((o = 'link[rel="' + e + '"][href="' + o + '"]'),
              'string' == typeof n && (o += '[crossorigin="' + n + '"]'),
              Od.has(o) ||
                (Od.add(o),
                (e = { rel: e, crossOrigin: n, href: t }),
                null === r.querySelector(o) &&
                  (Jc((t = r.createElement('link')), 'link', e), He(t), r.head.appendChild(t))))
          }
        }
        function Cd(e, t, n, r) {
          var o,
            a,
            i,
            s,
            u = (u = B.current) ? kd(u) : null
          if (!u) throw Error(l(446))
          switch (e) {
            case 'meta':
            case 'title':
              return null
            case 'style':
              return 'string' == typeof n.precedence && 'string' == typeof n.href
                ? ((t = Ed(n.href)),
                  (r = (n = Be(u).hoistableStyles).get(t)) ||
                    ((r = { type: 'style', instance: null, count: 0, state: null }), n.set(t, r)),
                  r)
                : { type: 'void', instance: null, count: 0, state: null }
            case 'link':
              if (
                'stylesheet' === n.rel &&
                'string' == typeof n.href &&
                'string' == typeof n.precedence
              ) {
                e = Ed(n.href)
                var c = Be(u).hoistableStyles,
                  d = c.get(e)
                if (
                  (d ||
                    ((u = u.ownerDocument || u),
                    (d = {
                      type: 'stylesheet',
                      instance: null,
                      count: 0,
                      state: { loading: 0, preload: null },
                    }),
                    c.set(e, d),
                    (c = u.querySelector(jd(e))) &&
                      !c._p &&
                      ((d.instance = c), (d.state.loading = 5)),
                    wd.has(e) ||
                      ((n = {
                        rel: 'preload',
                        as: 'style',
                        href: n.href,
                        crossOrigin: n.crossOrigin,
                        integrity: n.integrity,
                        media: n.media,
                        hrefLang: n.hrefLang,
                        referrerPolicy: n.referrerPolicy,
                      }),
                      wd.set(e, n),
                      c ||
                        ((o = u),
                        (a = e),
                        (i = n),
                        (s = d.state),
                        o.querySelector('link[rel="preload"][as="style"][' + a + ']')
                          ? (s.loading = 1)
                          : ((a = o.createElement('link')),
                            (s.preload = a),
                            a.addEventListener('load', function () {
                              return (s.loading |= 1)
                            }),
                            a.addEventListener('error', function () {
                              return (s.loading |= 2)
                            }),
                            Jc(a, 'link', i),
                            He(a),
                            o.head.appendChild(a))))),
                  t && null === r)
                )
                  throw Error(l(528, ''))
                return d
              }
              if (t && null !== r) throw Error(l(529, ''))
              return null
            case 'script':
              return (
                (t = n.async),
                'string' == typeof (n = n.src) &&
                t &&
                'function' != typeof t &&
                'symbol' != typeof t
                  ? ((t = Rd(n)),
                    (r = (n = Be(u).hoistableScripts).get(t)) ||
                      ((r = { type: 'script', instance: null, count: 0, state: null }),
                      n.set(t, r)),
                    r)
                  : { type: 'void', instance: null, count: 0, state: null }
              )
            default:
              throw Error(l(444, e))
          }
        }
        function Ed(e) {
          return 'href="' + mt(e) + '"'
        }
        function jd(e) {
          return 'link[rel="stylesheet"][' + e + ']'
        }
        function Td(e) {
          return d({}, e, { 'data-precedence': e.precedence, precedence: null })
        }
        function Rd(e) {
          return '[src="' + mt(e) + '"]'
        }
        function Nd(e) {
          return 'script[async]' + e
        }
        function Md(e, t, n) {
          if ((t.count++, null === t.instance))
            switch (t.type) {
              case 'style':
                var r = e.querySelector('style[data-href~="' + mt(n.href) + '"]')
                if (r) return ((t.instance = r), He(r), r)
                var o = d({}, n, {
                  'data-href': n.href,
                  'data-precedence': n.precedence,
                  href: null,
                  precedence: null,
                })
                return (
                  He((r = (e.ownerDocument || e).createElement('style'))),
                  Jc(r, 'style', o),
                  Ad(r, n.precedence, e),
                  (t.instance = r)
                )
              case 'stylesheet':
                o = Ed(n.href)
                var a = e.querySelector(jd(o))
                if (a) return ((t.state.loading |= 4), (t.instance = a), He(a), a)
                ;((r = Td(n)),
                  (o = wd.get(o)) && Dd(r, o),
                  He((a = (e.ownerDocument || e).createElement('link'))))
                var i = a
                return (
                  (i._p = new Promise(function (e, t) {
                    ;((i.onload = e), (i.onerror = t))
                  })),
                  Jc(a, 'link', r),
                  (t.state.loading |= 4),
                  Ad(a, n.precedence, e),
                  (t.instance = a)
                )
              case 'script':
                return (
                  (a = Rd(n.src)),
                  (o = e.querySelector(Nd(a)))
                    ? ((t.instance = o), He(o), o)
                    : ((r = n),
                      (o = wd.get(a)) && zd((r = d({}, n)), o),
                      He((o = (e = e.ownerDocument || e).createElement('script'))),
                      Jc(o, 'link', r),
                      e.head.appendChild(o),
                      (t.instance = o))
                )
              case 'void':
                return null
              default:
                throw Error(l(443, t.type))
            }
          else
            'stylesheet' === t.type &&
              !(4 & t.state.loading) &&
              ((r = t.instance), (t.state.loading |= 4), Ad(r, n.precedence, e))
          return t.instance
        }
        function Ad(e, t, n) {
          for (
            var r = n.querySelectorAll(
                'link[rel="stylesheet"][data-precedence],style[data-precedence]'
              ),
              o = r.length ? r[r.length - 1] : null,
              a = o,
              l = 0;
            l < r.length;
            l++
          ) {
            var i = r[l]
            if (i.dataset.precedence === t) a = i
            else if (a !== o) break
          }
          a
            ? a.parentNode.insertBefore(e, a.nextSibling)
            : (t = 9 === n.nodeType ? n.head : n).insertBefore(e, t.firstChild)
        }
        function Dd(e, t) {
          ;(null == e.crossOrigin && (e.crossOrigin = t.crossOrigin),
            null == e.referrerPolicy && (e.referrerPolicy = t.referrerPolicy),
            null == e.title && (e.title = t.title))
        }
        function zd(e, t) {
          ;(null == e.crossOrigin && (e.crossOrigin = t.crossOrigin),
            null == e.referrerPolicy && (e.referrerPolicy = t.referrerPolicy),
            null == e.integrity && (e.integrity = t.integrity))
        }
        var Id = null
        function $d(e, t, n) {
          if (null === Id) {
            var r = new Map(),
              o = (Id = new Map())
            o.set(n, r)
          } else (r = (o = Id).get(n)) || ((r = new Map()), o.set(n, r))
          if (r.has(e)) return r
          for (r.set(e, null), n = n.getElementsByTagName(e), o = 0; o < n.length; o++) {
            var a = n[o]
            if (
              !(a[$e] || a[Re] || ('link' === e && 'stylesheet' === a.getAttribute('rel'))) &&
              'http://www.w3.org/2000/svg' !== a.namespaceURI
            ) {
              var l = a.getAttribute(t) || ''
              l = e + l
              var i = r.get(l)
              i ? i.push(a) : r.set(l, [a])
            }
          }
          return r
        }
        function Ld(e, t, n) {
          ;(e = e.ownerDocument || e).head.insertBefore(
            n,
            'title' === t ? e.querySelector('head > title') : null
          )
        }
        function Fd(e) {
          return !!('stylesheet' !== e.type || 3 & e.state.loading)
        }
        var Vd = null
        function Wd() {}
        function Bd() {
          if ((this.count--, 0 === this.count))
            if (this.stylesheets) Ud(this, this.stylesheets)
            else if (this.unsuspend) {
              var e = this.unsuspend
              ;((this.unsuspend = null), e())
            }
        }
        var Hd = null
        function Ud(e, t) {
          ;((e.stylesheets = null),
            null !== e.unsuspend &&
              (e.count++, (Hd = new Map()), t.forEach(Gd, e), (Hd = null), Bd.call(e)))
        }
        function Gd(e, t) {
          if (!(4 & t.state.loading)) {
            var n = Hd.get(e)
            if (n) var r = n.get(null)
            else {
              ;((n = new Map()), Hd.set(e, n))
              for (
                var o = e.querySelectorAll('link[data-precedence],style[data-precedence]'), a = 0;
                a < o.length;
                a++
              ) {
                var l = o[a]
                ;('LINK' !== l.nodeName && 'not all' === l.getAttribute('media')) ||
                  (n.set(l.dataset.precedence, l), (r = l))
              }
              r && n.set(null, r)
            }
            ;((l = (o = t.instance).getAttribute('data-precedence')),
              (a = n.get(l) || r) === r && n.set(null, o),
              n.set(l, o),
              this.count++,
              (r = Bd.bind(this)),
              o.addEventListener('load', r),
              o.addEventListener('error', r),
              a
                ? a.parentNode.insertBefore(o, a.nextSibling)
                : (e = 9 === e.nodeType ? e.head : e).insertBefore(o, e.firstChild),
              (t.state.loading |= 4))
          }
        }
        var qd = {
          $$typeof: S,
          Provider: null,
          Consumer: null,
          _currentValue: D,
          _currentValue2: D,
          _threadCount: 0,
        }
        function Xd(e, t, n, r, o, a, l, i) {
          ;((this.tag = 1),
            (this.containerInfo = e),
            (this.pingCache = this.current = this.pendingChildren = null),
            (this.timeoutHandle = -1),
            (this.callbackNode =
              this.next =
              this.pendingContext =
              this.context =
              this.cancelPendingCommit =
                null),
            (this.callbackPriority = 0),
            (this.expirationTimes = ke(-1)),
            (this.entangledLanes =
              this.shellSuspendCounter =
              this.errorRecoveryDisabledLanes =
              this.expiredLanes =
              this.warmLanes =
              this.pingedLanes =
              this.suspendedLanes =
              this.pendingLanes =
                0),
            (this.entanglements = ke(0)),
            (this.hiddenUpdates = ke(null)),
            (this.identifierPrefix = r),
            (this.onUncaughtError = o),
            (this.onCaughtError = a),
            (this.onRecoverableError = l),
            (this.pooledCache = null),
            (this.pooledCacheLanes = 0),
            (this.formState = i),
            (this.incompleteTransitions = new Map()))
        }
        function Yd(e, t, n, r, o, a) {
          ;((o = (function (e) {
            return e ? (e = Mr) : Mr
          })(o)),
            null === r.context ? (r.context = o) : (r.pendingContext = o),
            ((r = oa(t)).payload = { element: n }),
            null !== (a = void 0 === a ? null : a) && (r.callback = a),
            null !== (n = aa(e, r, t)) && (Du(n, 0, t), la(n, e, t)))
        }
        function Kd(e, t) {
          if (null !== (e = e.memoizedState) && null !== e.dehydrated) {
            var n = e.retryLane
            e.retryLane = 0 !== n && n < t ? n : t
          }
        }
        function Qd(e, t) {
          ;(Kd(e, t), (e = e.alternate) && Kd(e, t))
        }
        function Zd(e) {
          if (13 === e.tag) {
            var t = Tr(e, 67108864)
            ;(null !== t && Du(t, 0, 67108864), Qd(e, 67108864))
          }
        }
        var Jd = !0
        function ef(e, t, n, r) {
          var o = M.T
          M.T = null
          var a = A.p
          try {
            ;((A.p = 2), nf(e, t, n, r))
          } finally {
            ;((A.p = a), (M.T = o))
          }
        }
        function tf(e, t, n, r) {
          var o = M.T
          M.T = null
          var a = A.p
          try {
            ;((A.p = 8), nf(e, t, n, r))
          } finally {
            ;((A.p = a), (M.T = o))
          }
        }
        function nf(e, t, n, r) {
          if (Jd) {
            var o = rf(r)
            if (null === o) (Vc(e, t, r, of, n), hf(e, r))
            else if (
              (function (e, t, n, r, o) {
                switch (t) {
                  case 'focusin':
                    return ((uf = gf(uf, e, t, n, r, o)), !0)
                  case 'dragenter':
                    return ((cf = gf(cf, e, t, n, r, o)), !0)
                  case 'mouseover':
                    return ((df = gf(df, e, t, n, r, o)), !0)
                  case 'pointerover':
                    var a = o.pointerId
                    return (ff.set(a, gf(ff.get(a) || null, e, t, n, r, o)), !0)
                  case 'gotpointercapture':
                    return ((a = o.pointerId), pf.set(a, gf(pf.get(a) || null, e, t, n, r, o)), !0)
                }
                return !1
              })(o, e, t, n, r)
            )
              r.stopPropagation()
            else if ((hf(e, r), 4 & t && -1 < bf.indexOf(e))) {
              for (; null !== o; ) {
                var a = Ve(o)
                if (null !== a)
                  switch (a.tag) {
                    case 3:
                      if ((a = a.stateNode).current.memoizedState.isDehydrated) {
                        var l = ge(a.pendingLanes)
                        if (0 !== l) {
                          var i = a
                          for (i.pendingLanes |= 2, i.entangledLanes |= 2; l; ) {
                            var s = 1 << (31 - fe(l))
                            ;((i.entanglements[1] |= s), (l &= ~s))
                          }
                          ;(wc(a), !(6 & tu) && ((wu = ee() + 500), Oc(0, !1)))
                        }
                      }
                      break
                    case 13:
                      ;(null !== (i = Tr(a, 2)) && Du(i, 0, 2), Fu(), Qd(a, 2))
                  }
                if ((null === (a = rf(r)) && Vc(e, t, r, of, n), a === o)) break
                o = a
              }
              null !== o && r.stopPropagation()
            } else Vc(e, t, r, null, n)
          }
        }
        function rf(e) {
          return af((e = Tt(e)))
        }
        var of = null
        function af(e) {
          if (((of = null), null !== (e = Fe(e)))) {
            var t = i(e)
            if (null === t) e = null
            else {
              var n = t.tag
              if (13 === n) {
                if (null !== (e = s(t))) return e
                e = null
              } else if (3 === n) {
                if (t.stateNode.current.memoizedState.isDehydrated)
                  return 3 === t.tag ? t.stateNode.containerInfo : null
                e = null
              } else t !== e && (e = null)
            }
          }
          return ((of = e), null)
        }
        function lf(e) {
          switch (e) {
            case 'beforetoggle':
            case 'cancel':
            case 'click':
            case 'close':
            case 'contextmenu':
            case 'copy':
            case 'cut':
            case 'auxclick':
            case 'dblclick':
            case 'dragend':
            case 'dragstart':
            case 'drop':
            case 'focusin':
            case 'focusout':
            case 'input':
            case 'invalid':
            case 'keydown':
            case 'keypress':
            case 'keyup':
            case 'mousedown':
            case 'mouseup':
            case 'paste':
            case 'pause':
            case 'play':
            case 'pointercancel':
            case 'pointerdown':
            case 'pointerup':
            case 'ratechange':
            case 'reset':
            case 'resize':
            case 'seeked':
            case 'submit':
            case 'toggle':
            case 'touchcancel':
            case 'touchend':
            case 'touchstart':
            case 'volumechange':
            case 'change':
            case 'selectionchange':
            case 'textInput':
            case 'compositionstart':
            case 'compositionend':
            case 'compositionupdate':
            case 'beforeblur':
            case 'afterblur':
            case 'beforeinput':
            case 'blur':
            case 'fullscreenchange':
            case 'focus':
            case 'hashchange':
            case 'popstate':
            case 'select':
            case 'selectstart':
              return 2
            case 'drag':
            case 'dragenter':
            case 'dragexit':
            case 'dragleave':
            case 'dragover':
            case 'mousemove':
            case 'mouseout':
            case 'mouseover':
            case 'pointermove':
            case 'pointerout':
            case 'pointerover':
            case 'scroll':
            case 'touchmove':
            case 'wheel':
            case 'mouseenter':
            case 'mouseleave':
            case 'pointerenter':
            case 'pointerleave':
              return 8
            case 'message':
              switch (te()) {
                case ne:
                  return 2
                case re:
                  return 8
                case oe:
                case ae:
                  return 32
                case le:
                  return 268435456
                default:
                  return 32
              }
            default:
              return 32
          }
        }
        var sf = !1,
          uf = null,
          cf = null,
          df = null,
          ff = new Map(),
          pf = new Map(),
          mf = [],
          bf =
            'mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset'.split(
              ' '
            )
        function hf(e, t) {
          switch (e) {
            case 'focusin':
            case 'focusout':
              uf = null
              break
            case 'dragenter':
            case 'dragleave':
              cf = null
              break
            case 'mouseover':
            case 'mouseout':
              df = null
              break
            case 'pointerover':
            case 'pointerout':
              ff.delete(t.pointerId)
              break
            case 'gotpointercapture':
            case 'lostpointercapture':
              pf.delete(t.pointerId)
          }
        }
        function gf(e, t, n, r, o, a) {
          return null === e || e.nativeEvent !== a
            ? ((e = {
                blockedOn: t,
                domEventName: n,
                eventSystemFlags: r,
                nativeEvent: a,
                targetContainers: [o],
              }),
              null !== t && null !== (t = Ve(t)) && Zd(t),
              e)
            : ((e.eventSystemFlags |= r),
              (t = e.targetContainers),
              null !== o && -1 === t.indexOf(o) && t.push(o),
              e)
        }
        function yf(e) {
          var t = Fe(e.target)
          if (null !== t) {
            var n = i(t)
            if (null !== n)
              if (13 === (t = n.tag)) {
                if (null !== (t = s(n)))
                  return (
                    (e.blockedOn = t),
                    void (function (e, t) {
                      var r = A.p
                      try {
                        return (
                          (A.p = e),
                          (function () {
                            if (13 === n.tag) {
                              var e = Mu()
                              e = Ce(e)
                              var t = Tr(n, e)
                              ;(null !== t && Du(t, 0, e), Qd(n, e))
                            }
                          })()
                        )
                      } finally {
                        A.p = r
                      }
                    })(e.priority)
                  )
              } else if (3 === t && n.stateNode.current.memoizedState.isDehydrated)
                return void (e.blockedOn = 3 === n.tag ? n.stateNode.containerInfo : null)
          }
          e.blockedOn = null
        }
        function vf(e) {
          if (null !== e.blockedOn) return !1
          for (var t = e.targetContainers; 0 < t.length; ) {
            var n = rf(e.nativeEvent)
            if (null !== n) return (null !== (t = Ve(n)) && Zd(t), (e.blockedOn = n), !1)
            var r = new (n = e.nativeEvent).constructor(n.type, n)
            ;((jt = r), n.target.dispatchEvent(r), (jt = null), t.shift())
          }
          return !0
        }
        function Sf(e, t, n) {
          vf(e) && n.delete(t)
        }
        function wf() {
          ;((sf = !1),
            null !== uf && vf(uf) && (uf = null),
            null !== cf && vf(cf) && (cf = null),
            null !== df && vf(df) && (df = null),
            ff.forEach(Sf),
            pf.forEach(Sf))
        }
        function Of(e, t) {
          e.blockedOn === t &&
            ((e.blockedOn = null),
            sf || ((sf = !0), r.unstable_scheduleCallback(r.unstable_NormalPriority, wf)))
        }
        var kf = null
        function xf(e) {
          kf !== e &&
            ((kf = e),
            r.unstable_scheduleCallback(r.unstable_NormalPriority, function () {
              kf === e && (kf = null)
              for (var t = 0; t < e.length; t += 3) {
                var n = e[t],
                  r = e[t + 1],
                  o = e[t + 2]
                if ('function' != typeof r) {
                  if (null === af(r || n)) continue
                  break
                }
                var a = Ve(n)
                null !== a &&
                  (e.splice(t, 3),
                  (t -= 3),
                  Tl(a, { pending: !0, data: o, method: n.method, action: r }, r, o))
              }
            }))
        }
        function Pf(e) {
          function t(t) {
            return Of(t, e)
          }
          ;(null !== uf && Of(uf, e),
            null !== cf && Of(cf, e),
            null !== df && Of(df, e),
            ff.forEach(t),
            pf.forEach(t))
          for (var n = 0; n < mf.length; n++) {
            var r = mf[n]
            r.blockedOn === e && (r.blockedOn = null)
          }
          for (; 0 < mf.length && null === (n = mf[0]).blockedOn; )
            (yf(n), null === n.blockedOn && mf.shift())
          if (null != (n = (e.ownerDocument || e).$$reactFormReplay))
            for (r = 0; r < n.length; r += 3) {
              var o = n[r],
                a = n[r + 1],
                l = o[Ne] || null
              if ('function' == typeof a) l || xf(n)
              else if (l) {
                var i = null
                if (a && a.hasAttribute('formAction')) {
                  if (((o = a), (l = a[Ne] || null))) i = l.formAction
                  else if (null !== af(o)) continue
                } else i = l.action
                ;('function' == typeof i ? (n[r + 1] = i) : (n.splice(r, 3), (r -= 3)), xf(n))
              }
            }
        }
        function _f(e) {
          this._internalRoot = e
        }
        function Cf(e) {
          this._internalRoot = e
        }
        ;((Cf.prototype.render = _f.prototype.render =
          function (e) {
            var t = this._internalRoot
            if (null === t) throw Error(l(409))
            Yd(t.current, Mu(), e, t, null, null)
          }),
          (Cf.prototype.unmount = _f.prototype.unmount =
            function () {
              var e = this._internalRoot
              if (null !== e) {
                this._internalRoot = null
                var t = e.containerInfo
                ;(Yd(e.current, 2, null, e, null, null), Fu(), (t[Me] = null))
              }
            }),
          (Cf.prototype.unstable_scheduleHydration = function (e) {
            if (e) {
              var t = je()
              e = { blockedOn: null, target: e, priority: t }
              for (var n = 0; n < mf.length && 0 !== t && t < mf[n].priority; n++);
              ;(mf.splice(n, 0, e), 0 === n && yf(e))
            }
          }))
        var Ef = o.version
        if ('19.1.0' !== Ef) throw Error(l(527, Ef, '19.1.0'))
        A.findDOMNode = function (e) {
          var t = e._reactInternals
          if (void 0 === t) {
            if ('function' == typeof e.render) throw Error(l(188))
            throw ((e = Object.keys(e).join(',')), Error(l(268, e)))
          }
          return (
            (e = (function (e) {
              var t = e.alternate
              if (!t) {
                if (null === (t = i(e))) throw Error(l(188))
                return t !== e ? null : e
              }
              for (var n = e, r = t; ; ) {
                var o = n.return
                if (null === o) break
                var a = o.alternate
                if (null === a) {
                  if (null !== (r = o.return)) {
                    n = r
                    continue
                  }
                  break
                }
                if (o.child === a.child) {
                  for (a = o.child; a; ) {
                    if (a === n) return (u(o), e)
                    if (a === r) return (u(o), t)
                    a = a.sibling
                  }
                  throw Error(l(188))
                }
                if (n.return !== r.return) ((n = o), (r = a))
                else {
                  for (var s = !1, c = o.child; c; ) {
                    if (c === n) {
                      ;((s = !0), (n = o), (r = a))
                      break
                    }
                    if (c === r) {
                      ;((s = !0), (r = o), (n = a))
                      break
                    }
                    c = c.sibling
                  }
                  if (!s) {
                    for (c = a.child; c; ) {
                      if (c === n) {
                        ;((s = !0), (n = a), (r = o))
                        break
                      }
                      if (c === r) {
                        ;((s = !0), (r = a), (n = o))
                        break
                      }
                      c = c.sibling
                    }
                    if (!s) throw Error(l(189))
                  }
                }
                if (n.alternate !== r) throw Error(l(190))
              }
              if (3 !== n.tag) throw Error(l(188))
              return n.stateNode.current === n ? e : t
            })(t)),
            null === (e = null !== e ? c(e) : null) ? null : e.stateNode
          )
        }
        var jf = {
          bundleType: 0,
          version: '19.1.0',
          rendererPackageName: 'react-dom',
          currentDispatcherRef: M,
          reconcilerVersion: '19.1.0',
        }
        if ('undefined' != typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
          var Tf = __REACT_DEVTOOLS_GLOBAL_HOOK__
          if (!Tf.isDisabled && Tf.supportsFiber)
            try {
              ;((ue = Tf.inject(jf)), (ce = Tf))
            } catch (e) {}
        }
        t.createRoot = function (e, t) {
          if (!(n = e) || (1 !== n.nodeType && 9 !== n.nodeType && 11 !== n.nodeType))
            throw Error(l(299))
          var n,
            r = !1,
            o = '',
            a = gi,
            i = yi,
            s = vi
          return (
            null != t &&
              (!0 === t.unstable_strictMode && (r = !0),
              void 0 !== t.identifierPrefix && (o = t.identifierPrefix),
              void 0 !== t.onUncaughtError && (a = t.onUncaughtError),
              void 0 !== t.onCaughtError && (i = t.onCaughtError),
              void 0 !== t.onRecoverableError && (s = t.onRecoverableError),
              void 0 !== t.unstable_transitionCallbacks && t.unstable_transitionCallbacks),
            (t = (function (e, t, n, r, o, a, l, i, s, u, c, d) {
              return (
                (e = new Xd(e, t, n, l, i, s, u, d)),
                (t = 1),
                !0 === a && (t |= 24),
                (a = Dr(3, null, null, t)),
                (e.current = a),
                (a.stateNode = e),
                (t = Mo()).refCount++,
                (e.pooledCache = t),
                t.refCount++,
                (a.memoizedState = { element: r, isDehydrated: n, cache: t }),
                na(a),
                e
              )
            })(e, 1, !1, null, 0, r, o, a, i, s, 0, null)),
            (e[Me] = t.current),
            Lc(e),
            new _f(t)
          )
        }
      },
      3348: (e, t, n) => {
        'use strict'
        var r = n(7527)
        function o(e) {
          var t = 'https://react.dev/errors/' + e
          if (1 < arguments.length) {
            t += '?args[]=' + encodeURIComponent(arguments[1])
            for (var n = 2; n < arguments.length; n++)
              t += '&args[]=' + encodeURIComponent(arguments[n])
          }
          return (
            'Minified React error #' +
            e +
            '; visit ' +
            t +
            ' for the full message or use the non-minified dev environment for full errors and additional helpful warnings.'
          )
        }
        function a() {}
        var l = {
            d: {
              f: a,
              r: function () {
                throw Error(o(522))
              },
              D: a,
              C: a,
              L: a,
              m: a,
              X: a,
              S: a,
              M: a,
            },
            p: 0,
            findDOMNode: null,
          },
          i = Symbol.for('react.portal'),
          s = r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
        function u(e, t) {
          return 'font' === e
            ? ''
            : 'string' == typeof t
              ? 'use-credentials' === t
                ? t
                : ''
              : void 0
        }
        ;((t.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = l),
          (t.createPortal = function (e, t) {
            var n = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null
            if (!t || (1 !== t.nodeType && 9 !== t.nodeType && 11 !== t.nodeType))
              throw Error(o(299))
            return (function (e, t, n) {
              var r = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null
              return {
                $$typeof: i,
                key: null == r ? null : '' + r,
                children: e,
                containerInfo: t,
                implementation: n,
              }
            })(e, t, null, n)
          }),
          (t.flushSync = function (e) {
            var t = s.T,
              n = l.p
            try {
              if (((s.T = null), (l.p = 2), e)) return e()
            } finally {
              ;((s.T = t), (l.p = n), l.d.f())
            }
          }),
          (t.preconnect = function (e, t) {
            'string' == typeof e &&
              ((t = t
                ? 'string' == typeof (t = t.crossOrigin)
                  ? 'use-credentials' === t
                    ? t
                    : ''
                  : void 0
                : null),
              l.d.C(e, t))
          }),
          (t.prefetchDNS = function (e) {
            'string' == typeof e && l.d.D(e)
          }),
          (t.preinit = function (e, t) {
            if ('string' == typeof e && t && 'string' == typeof t.as) {
              var n = t.as,
                r = u(n, t.crossOrigin),
                o = 'string' == typeof t.integrity ? t.integrity : void 0,
                a = 'string' == typeof t.fetchPriority ? t.fetchPriority : void 0
              'style' === n
                ? l.d.S(e, 'string' == typeof t.precedence ? t.precedence : void 0, {
                    crossOrigin: r,
                    integrity: o,
                    fetchPriority: a,
                  })
                : 'script' === n &&
                  l.d.X(e, {
                    crossOrigin: r,
                    integrity: o,
                    fetchPriority: a,
                    nonce: 'string' == typeof t.nonce ? t.nonce : void 0,
                  })
            }
          }),
          (t.preinitModule = function (e, t) {
            if ('string' == typeof e)
              if ('object' == typeof t && null !== t) {
                if (null == t.as || 'script' === t.as) {
                  var n = u(t.as, t.crossOrigin)
                  l.d.M(e, {
                    crossOrigin: n,
                    integrity: 'string' == typeof t.integrity ? t.integrity : void 0,
                    nonce: 'string' == typeof t.nonce ? t.nonce : void 0,
                  })
                }
              } else null == t && l.d.M(e)
          }),
          (t.preload = function (e, t) {
            if (
              'string' == typeof e &&
              'object' == typeof t &&
              null !== t &&
              'string' == typeof t.as
            ) {
              var n = t.as,
                r = u(n, t.crossOrigin)
              l.d.L(e, n, {
                crossOrigin: r,
                integrity: 'string' == typeof t.integrity ? t.integrity : void 0,
                nonce: 'string' == typeof t.nonce ? t.nonce : void 0,
                type: 'string' == typeof t.type ? t.type : void 0,
                fetchPriority: 'string' == typeof t.fetchPriority ? t.fetchPriority : void 0,
                referrerPolicy: 'string' == typeof t.referrerPolicy ? t.referrerPolicy : void 0,
                imageSrcSet: 'string' == typeof t.imageSrcSet ? t.imageSrcSet : void 0,
                imageSizes: 'string' == typeof t.imageSizes ? t.imageSizes : void 0,
                media: 'string' == typeof t.media ? t.media : void 0,
              })
            }
          }),
          (t.preloadModule = function (e, t) {
            if ('string' == typeof e)
              if (t) {
                var n = u(t.as, t.crossOrigin)
                l.d.m(e, {
                  as: 'string' == typeof t.as && 'script' !== t.as ? t.as : void 0,
                  crossOrigin: n,
                  integrity: 'string' == typeof t.integrity ? t.integrity : void 0,
                })
              } else l.d.m(e)
          }),
          (t.requestFormReset = function (e) {
            l.d.r(e)
          }),
          (t.unstable_batchedUpdates = function (e, t) {
            return e(t)
          }),
          (t.useFormState = function (e, t, n) {
            return s.H.useFormState(e, t, n)
          }),
          (t.useFormStatus = function () {
            return s.H.useHostTransitionStatus()
          }),
          (t.version = '19.1.0'))
      },
      4107: (e, t, n) => {
        'use strict'
        ;(!(function e() {
          if (
            'undefined' != typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ &&
            'function' == typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE
          )
            try {
              __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(e)
            } catch (e) {
              console.error(e)
            }
        })(),
          (e.exports = n(9904)))
      },
      7970: (e, t, n) => {
        'use strict'
        ;(!(function e() {
          if (
            'undefined' != typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ &&
            'function' == typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE
          )
            try {
              __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(e)
            } catch (e) {
              console.error(e)
            }
        })(),
          (e.exports = n(3348)))
      },
      6395: (e, t) => {
        'use strict'
        var n = Symbol.for('react.transitional.element'),
          r = Symbol.for('react.fragment')
        function o(e, t, r) {
          var o = null
          if ((void 0 !== r && (o = '' + r), void 0 !== t.key && (o = '' + t.key), 'key' in t))
            for (var a in ((r = {}), t)) 'key' !== a && (r[a] = t[a])
          else r = t
          return (
            (t = r.ref),
            { $$typeof: n, type: e, key: o, ref: void 0 !== t ? t : null, props: r }
          )
        }
        ;((t.Fragment = r), (t.jsx = o), (t.jsxs = o))
      },
      404: (e, t) => {
        'use strict'
        var n = Symbol.for('react.transitional.element'),
          r = Symbol.for('react.portal'),
          o = Symbol.for('react.fragment'),
          a = Symbol.for('react.strict_mode'),
          l = Symbol.for('react.profiler'),
          i = Symbol.for('react.consumer'),
          s = Symbol.for('react.context'),
          u = Symbol.for('react.forward_ref'),
          c = Symbol.for('react.suspense'),
          d = Symbol.for('react.memo'),
          f = Symbol.for('react.lazy'),
          p = Symbol.iterator,
          m = {
            isMounted: function () {
              return !1
            },
            enqueueForceUpdate: function () {},
            enqueueReplaceState: function () {},
            enqueueSetState: function () {},
          },
          b = Object.assign,
          h = {}
        function g(e, t, n) {
          ;((this.props = e), (this.context = t), (this.refs = h), (this.updater = n || m))
        }
        function y() {}
        function v(e, t, n) {
          ;((this.props = e), (this.context = t), (this.refs = h), (this.updater = n || m))
        }
        ;((g.prototype.isReactComponent = {}),
          (g.prototype.setState = function (e, t) {
            if ('object' != typeof e && 'function' != typeof e && null != e)
              throw Error(
                'takes an object of state variables to update or a function which returns an object of state variables.'
              )
            this.updater.enqueueSetState(this, e, t, 'setState')
          }),
          (g.prototype.forceUpdate = function (e) {
            this.updater.enqueueForceUpdate(this, e, 'forceUpdate')
          }),
          (y.prototype = g.prototype))
        var S = (v.prototype = new y())
        ;((S.constructor = v), b(S, g.prototype), (S.isPureReactComponent = !0))
        var w = Array.isArray,
          O = { H: null, A: null, T: null, S: null, V: null },
          k = Object.prototype.hasOwnProperty
        function x(e, t, r, o, a, l) {
          return (
            (r = l.ref),
            { $$typeof: n, type: e, key: t, ref: void 0 !== r ? r : null, props: l }
          )
        }
        function P(e) {
          return 'object' == typeof e && null !== e && e.$$typeof === n
        }
        var _ = /\/+/g
        function C(e, t) {
          return 'object' == typeof e && null !== e && null != e.key
            ? ((n = '' + e.key),
              (r = { '=': '=0', ':': '=2' }),
              '$' +
                n.replace(/[=:]/g, function (e) {
                  return r[e]
                }))
            : t.toString(36)
          var n, r
        }
        function E() {}
        function j(e, t, o, a, l) {
          var i = typeof e
          ;('undefined' !== i && 'boolean' !== i) || (e = null)
          var s,
            u,
            c = !1
          if (null === e) c = !0
          else
            switch (i) {
              case 'bigint':
              case 'string':
              case 'number':
                c = !0
                break
              case 'object':
                switch (e.$$typeof) {
                  case n:
                  case r:
                    c = !0
                    break
                  case f:
                    return j((c = e._init)(e._payload), t, o, a, l)
                }
            }
          if (c)
            return (
              (l = l(e)),
              (c = '' === a ? '.' + C(e, 0) : a),
              w(l)
                ? ((o = ''),
                  null != c && (o = c.replace(_, '$&/') + '/'),
                  j(l, t, o, '', function (e) {
                    return e
                  }))
                : null != l &&
                  (P(l) &&
                    ((s = l),
                    (u =
                      o +
                      (null == l.key || (e && e.key === l.key)
                        ? ''
                        : ('' + l.key).replace(_, '$&/') + '/') +
                      c),
                    (l = x(s.type, u, void 0, 0, 0, s.props))),
                  t.push(l)),
              1
            )
          c = 0
          var d,
            m = '' === a ? '.' : a + ':'
          if (w(e))
            for (var b = 0; b < e.length; b++) c += j((a = e[b]), t, o, (i = m + C(a, b)), l)
          else if (
            'function' ==
            typeof (b =
              null === (d = e) || 'object' != typeof d
                ? null
                : 'function' == typeof (d = (p && d[p]) || d['@@iterator'])
                  ? d
                  : null)
          )
            for (e = b.call(e), b = 0; !(a = e.next()).done; )
              c += j((a = a.value), t, o, (i = m + C(a, b++)), l)
          else if ('object' === i) {
            if ('function' == typeof e.then)
              return j(
                (function (e) {
                  switch (e.status) {
                    case 'fulfilled':
                      return e.value
                    case 'rejected':
                      throw e.reason
                    default:
                      switch (
                        ('string' == typeof e.status
                          ? e.then(E, E)
                          : ((e.status = 'pending'),
                            e.then(
                              function (t) {
                                'pending' === e.status && ((e.status = 'fulfilled'), (e.value = t))
                              },
                              function (t) {
                                'pending' === e.status && ((e.status = 'rejected'), (e.reason = t))
                              }
                            )),
                        e.status)
                      ) {
                        case 'fulfilled':
                          return e.value
                        case 'rejected':
                          throw e.reason
                      }
                  }
                  throw e
                })(e),
                t,
                o,
                a,
                l
              )
            throw (
              (t = String(e)),
              Error(
                'Objects are not valid as a React child (found: ' +
                  ('[object Object]' === t
                    ? 'object with keys {' + Object.keys(e).join(', ') + '}'
                    : t) +
                  '). If you meant to render a collection of children, use an array instead.'
              )
            )
          }
          return c
        }
        function T(e, t, n) {
          if (null == e) return e
          var r = [],
            o = 0
          return (
            j(e, r, '', '', function (e) {
              return t.call(n, e, o++)
            }),
            r
          )
        }
        function R(e) {
          if (-1 === e._status) {
            var t = e._result
            ;((t = t()).then(
              function (t) {
                ;(0 !== e._status && -1 !== e._status) || ((e._status = 1), (e._result = t))
              },
              function (t) {
                ;(0 !== e._status && -1 !== e._status) || ((e._status = 2), (e._result = t))
              }
            ),
              -1 === e._status && ((e._status = 0), (e._result = t)))
          }
          if (1 === e._status) return e._result.default
          throw e._result
        }
        var N =
          'function' == typeof reportError
            ? reportError
            : function (e) {
                if ('object' == typeof window && 'function' == typeof window.ErrorEvent) {
                  var t = new window.ErrorEvent('error', {
                    bubbles: !0,
                    cancelable: !0,
                    message:
                      'object' == typeof e && null !== e && 'string' == typeof e.message
                        ? String(e.message)
                        : String(e),
                    error: e,
                  })
                  if (!window.dispatchEvent(t)) return
                } else if (
                  'function' ==
                  typeof { env: { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' } }.emit
                )
                  return void { env: { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' } }.emit(
                    'uncaughtException',
                    e
                  )
                console.error(e)
              }
        function M() {}
        ;((t.Children = {
          map: T,
          forEach: function (e, t, n) {
            T(
              e,
              function () {
                t.apply(this, arguments)
              },
              n
            )
          },
          count: function (e) {
            var t = 0
            return (
              T(e, function () {
                t++
              }),
              t
            )
          },
          toArray: function (e) {
            return (
              T(e, function (e) {
                return e
              }) || []
            )
          },
          only: function (e) {
            if (!P(e))
              throw Error('React.Children.only expected to receive a single React element child.')
            return e
          },
        }),
          (t.Component = g),
          (t.Fragment = o),
          (t.Profiler = l),
          (t.PureComponent = v),
          (t.StrictMode = a),
          (t.Suspense = c),
          (t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = O),
          (t.__COMPILER_RUNTIME = {
            __proto__: null,
            c: function (e) {
              return O.H.useMemoCache(e)
            },
          }),
          (t.cache = function (e) {
            return function () {
              return e.apply(null, arguments)
            }
          }),
          (t.cloneElement = function (e, t, n) {
            if (null == e)
              throw Error('The argument must be a React element, but you passed ' + e + '.')
            var r = b({}, e.props),
              o = e.key
            if (null != t)
              for (a in (t.ref, void 0 !== t.key && (o = '' + t.key), t))
                !k.call(t, a) ||
                  'key' === a ||
                  '__self' === a ||
                  '__source' === a ||
                  ('ref' === a && void 0 === t.ref) ||
                  (r[a] = t[a])
            var a = arguments.length - 2
            if (1 === a) r.children = n
            else if (1 < a) {
              for (var l = Array(a), i = 0; i < a; i++) l[i] = arguments[i + 2]
              r.children = l
            }
            return x(e.type, o, void 0, 0, 0, r)
          }),
          (t.createContext = function (e) {
            return (
              ((e = {
                $$typeof: s,
                _currentValue: e,
                _currentValue2: e,
                _threadCount: 0,
                Provider: null,
                Consumer: null,
              }).Provider = e),
              (e.Consumer = { $$typeof: i, _context: e }),
              e
            )
          }),
          (t.createElement = function (e, t, n) {
            var r,
              o = {},
              a = null
            if (null != t)
              for (r in (void 0 !== t.key && (a = '' + t.key), t))
                k.call(t, r) && 'key' !== r && '__self' !== r && '__source' !== r && (o[r] = t[r])
            var l = arguments.length - 2
            if (1 === l) o.children = n
            else if (1 < l) {
              for (var i = Array(l), s = 0; s < l; s++) i[s] = arguments[s + 2]
              o.children = i
            }
            if (e && e.defaultProps)
              for (r in (l = e.defaultProps)) void 0 === o[r] && (o[r] = l[r])
            return x(e, a, void 0, 0, 0, o)
          }),
          (t.createRef = function () {
            return { current: null }
          }),
          (t.forwardRef = function (e) {
            return { $$typeof: u, render: e }
          }),
          (t.isValidElement = P),
          (t.lazy = function (e) {
            return { $$typeof: f, _payload: { _status: -1, _result: e }, _init: R }
          }),
          (t.memo = function (e, t) {
            return { $$typeof: d, type: e, compare: void 0 === t ? null : t }
          }),
          (t.startTransition = function (e) {
            var t = O.T,
              n = {}
            O.T = n
            try {
              var r = e(),
                o = O.S
              ;(null !== o && o(n, r),
                'object' == typeof r && null !== r && 'function' == typeof r.then && r.then(M, N))
            } catch (e) {
              N(e)
            } finally {
              O.T = t
            }
          }),
          (t.unstable_useCacheRefresh = function () {
            return O.H.useCacheRefresh()
          }),
          (t.use = function (e) {
            return O.H.use(e)
          }),
          (t.useActionState = function (e, t, n) {
            return O.H.useActionState(e, t, n)
          }),
          (t.useCallback = function (e, t) {
            return O.H.useCallback(e, t)
          }),
          (t.useContext = function (e) {
            return O.H.useContext(e)
          }),
          (t.useDebugValue = function () {}),
          (t.useDeferredValue = function (e, t) {
            return O.H.useDeferredValue(e, t)
          }),
          (t.useEffect = function (e, t, n) {
            var r = O.H
            if ('function' == typeof n)
              throw Error('useEffect CRUD overload is not enabled in this build of React.')
            return r.useEffect(e, t)
          }),
          (t.useId = function () {
            return O.H.useId()
          }),
          (t.useImperativeHandle = function (e, t, n) {
            return O.H.useImperativeHandle(e, t, n)
          }),
          (t.useInsertionEffect = function (e, t) {
            return O.H.useInsertionEffect(e, t)
          }),
          (t.useLayoutEffect = function (e, t) {
            return O.H.useLayoutEffect(e, t)
          }),
          (t.useMemo = function (e, t) {
            return O.H.useMemo(e, t)
          }),
          (t.useOptimistic = function (e, t) {
            return O.H.useOptimistic(e, t)
          }),
          (t.useReducer = function (e, t, n) {
            return O.H.useReducer(e, t, n)
          }),
          (t.useRef = function (e) {
            return O.H.useRef(e)
          }),
          (t.useState = function (e) {
            return O.H.useState(e)
          }),
          (t.useSyncExternalStore = function (e, t, n) {
            return O.H.useSyncExternalStore(e, t, n)
          }),
          (t.useTransition = function () {
            return O.H.useTransition()
          }),
          (t.version = '19.1.0'))
      },
      7527: (e, t, n) => {
        'use strict'
        e.exports = n(404)
      },
      2351: (e, t, n) => {
        'use strict'
        e.exports = n(6395)
      },
      3436: (e, t) => {
        'use strict'
        function n(e, t) {
          var n = e.length
          e.push(t)
          e: for (; 0 < n; ) {
            var r = (n - 1) >>> 1,
              o = e[r]
            if (!(0 < a(o, t))) break e
            ;((e[r] = t), (e[n] = o), (n = r))
          }
        }
        function r(e) {
          return 0 === e.length ? null : e[0]
        }
        function o(e) {
          if (0 === e.length) return null
          var t = e[0],
            n = e.pop()
          if (n !== t) {
            e[0] = n
            e: for (var r = 0, o = e.length, l = o >>> 1; r < l; ) {
              var i = 2 * (r + 1) - 1,
                s = e[i],
                u = i + 1,
                c = e[u]
              if (0 > a(s, n))
                u < o && 0 > a(c, s)
                  ? ((e[r] = c), (e[u] = n), (r = u))
                  : ((e[r] = s), (e[i] = n), (r = i))
              else {
                if (!(u < o && 0 > a(c, n))) break e
                ;((e[r] = c), (e[u] = n), (r = u))
              }
            }
          }
          return t
        }
        function a(e, t) {
          var n = e.sortIndex - t.sortIndex
          return 0 !== n ? n : e.id - t.id
        }
        if (
          ((t.unstable_now = void 0),
          'object' == typeof performance && 'function' == typeof performance.now)
        ) {
          var l = performance
          t.unstable_now = function () {
            return l.now()
          }
        } else {
          var i = Date,
            s = i.now()
          t.unstable_now = function () {
            return i.now() - s
          }
        }
        var u = [],
          c = [],
          d = 1,
          f = null,
          p = 3,
          m = !1,
          b = !1,
          h = !1,
          g = !1,
          y = 'function' == typeof setTimeout ? setTimeout : null,
          v = 'function' == typeof clearTimeout ? clearTimeout : null,
          S = 'undefined' != typeof setImmediate ? setImmediate : null
        function w(e) {
          for (var t = r(c); null !== t; ) {
            if (null === t.callback) o(c)
            else {
              if (!(t.startTime <= e)) break
              ;(o(c), (t.sortIndex = t.expirationTime), n(u, t))
            }
            t = r(c)
          }
        }
        function O(e) {
          if (((h = !1), w(e), !b))
            if (null !== r(u)) ((b = !0), x || ((x = !0), k()))
            else {
              var t = r(c)
              null !== t && N(O, t.startTime - e)
            }
        }
        var k,
          x = !1,
          P = -1,
          _ = 5,
          C = -1
        function E() {
          return !(!g && t.unstable_now() - C < _)
        }
        function j() {
          if (((g = !1), x)) {
            var e = t.unstable_now()
            C = e
            var n = !0
            try {
              e: {
                ;((b = !1), h && ((h = !1), v(P), (P = -1)), (m = !0))
                var a = p
                try {
                  t: {
                    for (w(e), f = r(u); null !== f && !(f.expirationTime > e && E()); ) {
                      var l = f.callback
                      if ('function' == typeof l) {
                        ;((f.callback = null), (p = f.priorityLevel))
                        var i = l(f.expirationTime <= e)
                        if (((e = t.unstable_now()), 'function' == typeof i)) {
                          ;((f.callback = i), w(e), (n = !0))
                          break t
                        }
                        ;(f === r(u) && o(u), w(e))
                      } else o(u)
                      f = r(u)
                    }
                    if (null !== f) n = !0
                    else {
                      var s = r(c)
                      ;(null !== s && N(O, s.startTime - e), (n = !1))
                    }
                  }
                  break e
                } finally {
                  ;((f = null), (p = a), (m = !1))
                }
                n = void 0
              }
            } finally {
              n ? k() : (x = !1)
            }
          }
        }
        if ('function' == typeof S)
          k = function () {
            S(j)
          }
        else if ('undefined' != typeof MessageChannel) {
          var T = new MessageChannel(),
            R = T.port2
          ;((T.port1.onmessage = j),
            (k = function () {
              R.postMessage(null)
            }))
        } else
          k = function () {
            y(j, 0)
          }
        function N(e, n) {
          P = y(function () {
            e(t.unstable_now())
          }, n)
        }
        ;((t.unstable_IdlePriority = 5),
          (t.unstable_ImmediatePriority = 1),
          (t.unstable_LowPriority = 4),
          (t.unstable_NormalPriority = 3),
          (t.unstable_Profiling = null),
          (t.unstable_UserBlockingPriority = 2),
          (t.unstable_cancelCallback = function (e) {
            e.callback = null
          }),
          (t.unstable_forceFrameRate = function (e) {
            0 > e || 125 < e
              ? console.error(
                  'forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported'
                )
              : (_ = 0 < e ? Math.floor(1e3 / e) : 5)
          }),
          (t.unstable_getCurrentPriorityLevel = function () {
            return p
          }),
          (t.unstable_next = function (e) {
            switch (p) {
              case 1:
              case 2:
              case 3:
                var t = 3
                break
              default:
                t = p
            }
            var n = p
            p = t
            try {
              return e()
            } finally {
              p = n
            }
          }),
          (t.unstable_requestPaint = function () {
            g = !0
          }),
          (t.unstable_runWithPriority = function (e, t) {
            switch (e) {
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
                break
              default:
                e = 3
            }
            var n = p
            p = e
            try {
              return t()
            } finally {
              p = n
            }
          }),
          (t.unstable_scheduleCallback = function (e, o, a) {
            var l = t.unstable_now()
            switch (
              ((a =
                'object' == typeof a && null !== a && 'number' == typeof (a = a.delay) && 0 < a
                  ? l + a
                  : l),
              e)
            ) {
              case 1:
                var i = -1
                break
              case 2:
                i = 250
                break
              case 5:
                i = 1073741823
                break
              case 4:
                i = 1e4
                break
              default:
                i = 5e3
            }
            return (
              (e = {
                id: d++,
                callback: o,
                priorityLevel: e,
                startTime: a,
                expirationTime: (i = a + i),
                sortIndex: -1,
              }),
              a > l
                ? ((e.sortIndex = a),
                  n(c, e),
                  null === r(u) && e === r(c) && (h ? (v(P), (P = -1)) : (h = !0), N(O, a - l)))
                : ((e.sortIndex = i), n(u, e), b || m || ((b = !0), x || ((x = !0), k()))),
              e
            )
          }),
          (t.unstable_shouldYield = E),
          (t.unstable_wrapCallback = function (e) {
            var t = p
            return function () {
              var n = p
              p = t
              try {
                return e.apply(this, arguments)
              } finally {
                p = n
              }
            }
          }))
      },
      9921: (e, t, n) => {
        'use strict'
        e.exports = n(3436)
      },
      1613: (e, t) => {
        'use strict'
        t.P = void 0
        var n = new WeakMap()
        function r(e) {
          var t, r, o
          return (
            null != e &&
              ((t = !0 === e.disableCache), (r = !0 === e.disableMix), (o = e.transform)),
            function () {
              for (
                var e = [],
                  a = '',
                  l = null,
                  i = t ? null : n,
                  s = new Array(arguments.length),
                  u = 0;
                u < arguments.length;
                u++
              )
                s[u] = arguments[u]
              for (; s.length > 0; ) {
                var c = s.pop()
                if (null != c && !1 !== c)
                  if (Array.isArray(c)) for (var d = 0; d < c.length; d++) s.push(c[d])
                  else {
                    var f = null != o ? o(c) : c
                    if (f.$$css) {
                      var p = ''
                      if (null != i && i.has(f)) {
                        var m = i.get(f)
                        null != m && ((p = m[0]), e.push.apply(e, m[1]), (i = m[2]))
                      } else {
                        var b = []
                        for (var h in f) {
                          var g = f[h]
                          '$$css' !== h &&
                            ('string' == typeof g || null === g
                              ? e.includes(h) ||
                                (e.push(h),
                                null != i && b.push(h),
                                'string' == typeof g && (p += p ? ' ' + g : g))
                              : console.error(
                                  'styleq: '
                                    .concat(h, ' typeof ')
                                    .concat(String(g), ' is not "string" or "null".')
                                ))
                        }
                        if (null != i) {
                          var y = new WeakMap()
                          ;(i.set(f, [p, b, y]), (i = y))
                        }
                      }
                      p && (a = a ? p + ' ' + a : p)
                    } else if (r) (null == l && (l = {}), (l = Object.assign({}, f, l)))
                    else {
                      var v = null
                      for (var S in f) {
                        var w = f[S]
                        void 0 !== w &&
                          (e.includes(S) ||
                            (null != w &&
                              (null == l && (l = {}), null == v && (v = {}), (v[S] = w)),
                            e.push(S),
                            (i = null)))
                      }
                      null != v && (l = Object.assign(v, l))
                    }
                  }
              }
              return [a, l]
            }
          )
        }
        var o = r()
        ;((t.P = o), (o.factory = r))
      },
      9121: (e, t) => {
        'use strict'
        t.n = function (e, t) {
          if (null != e[r]) {
            var a = t ? 1 : 0
            if (n.has(e)) {
              var l = n.get(e),
                i = l[a]
              return (null == i && ((i = o(e, t)), (l[a] = i), n.set(e, l)), i)
            }
            var s = o(e, t),
              u = new Array(2)
            return ((u[a] = s), n.set(e, u), s)
          }
          return e
        }
        var n = new WeakMap(),
          r = '$$css$localize'
        function o(e, t) {
          var n = {}
          for (var o in e)
            if (o !== r) {
              var a = e[o]
              Array.isArray(a) ? (n[o] = t ? a[1] : a[0]) : (n[o] = a)
            }
          return n
        }
      },
      4855: (e, t, n) => {
        'use strict'
        var r = n(4441),
          o = Symbol.for('react.element'),
          a = (Symbol.for('react.fragment'), Object.prototype.hasOwnProperty),
          l = r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,
          i = { key: !0, ref: !0, __self: !0, __source: !0 }
        t.jsx = function (e, t, n) {
          var r,
            s = {},
            u = null,
            c = null
          for (r in (void 0 !== n && (u = '' + n),
          void 0 !== t.key && (u = '' + t.key),
          void 0 !== t.ref && (c = t.ref),
          t))
            a.call(t, r) && !i.hasOwnProperty(r) && (s[r] = t[r])
          if (e && e.defaultProps) for (r in (t = e.defaultProps)) void 0 === s[r] && (s[r] = t[r])
          return { $$typeof: o, type: e, key: u, ref: c, props: s, _owner: l.current }
        }
      },
      5632: (e, t) => {
        'use strict'
        var n = Symbol.for('react.element'),
          r = Symbol.for('react.portal'),
          o = Symbol.for('react.fragment'),
          a = Symbol.for('react.strict_mode'),
          l = Symbol.for('react.profiler'),
          i = Symbol.for('react.provider'),
          s = Symbol.for('react.context'),
          u = Symbol.for('react.forward_ref'),
          c = Symbol.for('react.suspense'),
          d = Symbol.for('react.memo'),
          f = Symbol.for('react.lazy'),
          p = Symbol.iterator,
          m = {
            isMounted: function () {
              return !1
            },
            enqueueForceUpdate: function () {},
            enqueueReplaceState: function () {},
            enqueueSetState: function () {},
          },
          b = Object.assign,
          h = {}
        function g(e, t, n) {
          ;((this.props = e), (this.context = t), (this.refs = h), (this.updater = n || m))
        }
        function y() {}
        function v(e, t, n) {
          ;((this.props = e), (this.context = t), (this.refs = h), (this.updater = n || m))
        }
        ;((g.prototype.isReactComponent = {}),
          (g.prototype.setState = function (e, t) {
            if ('object' != typeof e && 'function' != typeof e && null != e)
              throw Error(
                'setState(...): takes an object of state variables to update or a function which returns an object of state variables.'
              )
            this.updater.enqueueSetState(this, e, t, 'setState')
          }),
          (g.prototype.forceUpdate = function (e) {
            this.updater.enqueueForceUpdate(this, e, 'forceUpdate')
          }),
          (y.prototype = g.prototype))
        var S = (v.prototype = new y())
        ;((S.constructor = v), b(S, g.prototype), (S.isPureReactComponent = !0))
        var w = Array.isArray,
          O = Object.prototype.hasOwnProperty,
          k = { current: null },
          x = { key: !0, ref: !0, __self: !0, __source: !0 }
        function P(e, t, r) {
          var o,
            a = {},
            l = null,
            i = null
          if (null != t)
            for (o in (void 0 !== t.ref && (i = t.ref), void 0 !== t.key && (l = '' + t.key), t))
              O.call(t, o) && !x.hasOwnProperty(o) && (a[o] = t[o])
          var s = arguments.length - 2
          if (1 === s) a.children = r
          else if (1 < s) {
            for (var u = Array(s), c = 0; c < s; c++) u[c] = arguments[c + 2]
            a.children = u
          }
          if (e && e.defaultProps) for (o in (s = e.defaultProps)) void 0 === a[o] && (a[o] = s[o])
          return { $$typeof: n, type: e, key: l, ref: i, props: a, _owner: k.current }
        }
        function _(e) {
          return 'object' == typeof e && null !== e && e.$$typeof === n
        }
        var C = /\/+/g
        function E(e, t) {
          return 'object' == typeof e && null !== e && null != e.key
            ? (function (e) {
                var t = { '=': '=0', ':': '=2' }
                return (
                  '$' +
                  e.replace(/[=:]/g, function (e) {
                    return t[e]
                  })
                )
              })('' + e.key)
            : t.toString(36)
        }
        function j(e, t, o, a, l) {
          var i = typeof e
          ;('undefined' !== i && 'boolean' !== i) || (e = null)
          var s = !1
          if (null === e) s = !0
          else
            switch (i) {
              case 'string':
              case 'number':
                s = !0
                break
              case 'object':
                switch (e.$$typeof) {
                  case n:
                  case r:
                    s = !0
                }
            }
          if (s)
            return (
              (l = l((s = e))),
              (e = '' === a ? '.' + E(s, 0) : a),
              w(l)
                ? ((o = ''),
                  null != e && (o = e.replace(C, '$&/') + '/'),
                  j(l, t, o, '', function (e) {
                    return e
                  }))
                : null != l &&
                  (_(l) &&
                    (l = (function (e, t) {
                      return {
                        $$typeof: n,
                        type: e.type,
                        key: t,
                        ref: e.ref,
                        props: e.props,
                        _owner: e._owner,
                      }
                    })(
                      l,
                      o +
                        (!l.key || (s && s.key === l.key)
                          ? ''
                          : ('' + l.key).replace(C, '$&/') + '/') +
                        e
                    )),
                  t.push(l)),
              1
            )
          if (((s = 0), (a = '' === a ? '.' : a + ':'), w(e)))
            for (var u = 0; u < e.length; u++) {
              var c = a + E((i = e[u]), u)
              s += j(i, t, o, c, l)
            }
          else if (
            ((c = (function (e) {
              return null === e || 'object' != typeof e
                ? null
                : 'function' == typeof (e = (p && e[p]) || e['@@iterator'])
                  ? e
                  : null
            })(e)),
            'function' == typeof c)
          )
            for (e = c.call(e), u = 0; !(i = e.next()).done; )
              s += j((i = i.value), t, o, (c = a + E(i, u++)), l)
          else if ('object' === i)
            throw (
              (t = String(e)),
              Error(
                'Objects are not valid as a React child (found: ' +
                  ('[object Object]' === t
                    ? 'object with keys {' + Object.keys(e).join(', ') + '}'
                    : t) +
                  '). If you meant to render a collection of children, use an array instead.'
              )
            )
          return s
        }
        function T(e, t, n) {
          if (null == e) return e
          var r = [],
            o = 0
          return (
            j(e, r, '', '', function (e) {
              return t.call(n, e, o++)
            }),
            r
          )
        }
        function R(e) {
          if (-1 === e._status) {
            var t = e._result
            ;((t = t()).then(
              function (t) {
                ;(0 !== e._status && -1 !== e._status) || ((e._status = 1), (e._result = t))
              },
              function (t) {
                ;(0 !== e._status && -1 !== e._status) || ((e._status = 2), (e._result = t))
              }
            ),
              -1 === e._status && ((e._status = 0), (e._result = t)))
          }
          if (1 === e._status) return e._result.default
          throw e._result
        }
        var N = { current: null },
          M = { transition: null },
          A = { ReactCurrentDispatcher: N, ReactCurrentBatchConfig: M, ReactCurrentOwner: k }
        function D() {
          throw Error('act(...) is not supported in production builds of React.')
        }
        ;((t.Children = {
          map: T,
          forEach: function (e, t, n) {
            T(
              e,
              function () {
                t.apply(this, arguments)
              },
              n
            )
          },
          count: function (e) {
            var t = 0
            return (
              T(e, function () {
                t++
              }),
              t
            )
          },
          toArray: function (e) {
            return (
              T(e, function (e) {
                return e
              }) || []
            )
          },
          only: function (e) {
            if (!_(e))
              throw Error('React.Children.only expected to receive a single React element child.')
            return e
          },
        }),
          (t.Component = g),
          (t.Fragment = o),
          (t.Profiler = l),
          (t.PureComponent = v),
          (t.StrictMode = a),
          (t.Suspense = c),
          (t.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = A),
          (t.act = D),
          (t.cloneElement = function (e, t, r) {
            if (null == e)
              throw Error(
                'React.cloneElement(...): The argument must be a React element, but you passed ' +
                  e +
                  '.'
              )
            var o = b({}, e.props),
              a = e.key,
              l = e.ref,
              i = e._owner
            if (null != t) {
              if (
                (void 0 !== t.ref && ((l = t.ref), (i = k.current)),
                void 0 !== t.key && (a = '' + t.key),
                e.type && e.type.defaultProps)
              )
                var s = e.type.defaultProps
              for (u in t)
                O.call(t, u) &&
                  !x.hasOwnProperty(u) &&
                  (o[u] = void 0 === t[u] && void 0 !== s ? s[u] : t[u])
            }
            var u = arguments.length - 2
            if (1 === u) o.children = r
            else if (1 < u) {
              s = Array(u)
              for (var c = 0; c < u; c++) s[c] = arguments[c + 2]
              o.children = s
            }
            return { $$typeof: n, type: e.type, key: a, ref: l, props: o, _owner: i }
          }),
          (t.createContext = function (e) {
            return (
              ((e = {
                $$typeof: s,
                _currentValue: e,
                _currentValue2: e,
                _threadCount: 0,
                Provider: null,
                Consumer: null,
                _defaultValue: null,
                _globalName: null,
              }).Provider = { $$typeof: i, _context: e }),
              (e.Consumer = e)
            )
          }),
          (t.createElement = P),
          (t.createFactory = function (e) {
            var t = P.bind(null, e)
            return ((t.type = e), t)
          }),
          (t.createRef = function () {
            return { current: null }
          }),
          (t.forwardRef = function (e) {
            return { $$typeof: u, render: e }
          }),
          (t.isValidElement = _),
          (t.lazy = function (e) {
            return { $$typeof: f, _payload: { _status: -1, _result: e }, _init: R }
          }),
          (t.memo = function (e, t) {
            return { $$typeof: d, type: e, compare: void 0 === t ? null : t }
          }),
          (t.startTransition = function (e) {
            var t = M.transition
            M.transition = {}
            try {
              e()
            } finally {
              M.transition = t
            }
          }),
          (t.unstable_act = D),
          (t.useCallback = function (e, t) {
            return N.current.useCallback(e, t)
          }),
          (t.useContext = function (e) {
            return N.current.useContext(e)
          }),
          (t.useDebugValue = function () {}),
          (t.useDeferredValue = function (e) {
            return N.current.useDeferredValue(e)
          }),
          (t.useEffect = function (e, t) {
            return N.current.useEffect(e, t)
          }),
          (t.useId = function () {
            return N.current.useId()
          }),
          (t.useImperativeHandle = function (e, t, n) {
            return N.current.useImperativeHandle(e, t, n)
          }),
          (t.useInsertionEffect = function (e, t) {
            return N.current.useInsertionEffect(e, t)
          }),
          (t.useLayoutEffect = function (e, t) {
            return N.current.useLayoutEffect(e, t)
          }),
          (t.useMemo = function (e, t) {
            return N.current.useMemo(e, t)
          }),
          (t.useReducer = function (e, t, n) {
            return N.current.useReducer(e, t, n)
          }),
          (t.useRef = function (e) {
            return N.current.useRef(e)
          }),
          (t.useState = function (e) {
            return N.current.useState(e)
          }),
          (t.useSyncExternalStore = function (e, t, n) {
            return N.current.useSyncExternalStore(e, t, n)
          }),
          (t.useTransition = function () {
            return N.current.useTransition()
          }),
          (t.version = '18.3.1'))
      },
      4441: (e, t, n) => {
        'use strict'
        e.exports = n(5632)
      },
      445: (e, t, n) => {
        'use strict'
        e.exports = n(4855)
      },
      2822: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { composeRefs: () => m, setRef: () => p, useComposedRefs: () => b }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = ((e, t, n) => (
          (n = null != e ? o(s(e)) : {}),
          c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
        ))(n(7527))
        function p(e, t) {
          'function' == typeof e ? e(t) : e && (e.current = t)
        }
        function m(...e) {
          return (t) => e.forEach((e) => p(e, t))
        }
        function b(...e) {
          return f.useCallback(m(...e), e)
        }
      },
      6051: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let s of l(t))
                !i.call(e, s) &&
                  s !== n &&
                  o(e, s, { get: () => t[s], enumerable: !(r = a(t, s)) || r.enumerable })
            return e
          },
          u = {}
        ;((e.exports = ((r = u), s(o({}, '__esModule', { value: !0 }), r))),
          ((e, t, n) => {
            ;(s(e, t, 'default'), n && s(n, t, 'default'))
          })(u, n(2822), e.exports))
      },
      6618: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          IS_REACT_19: () => c,
          currentPlatform: () => w,
          isAndroid: () => v,
          isChrome: () => h,
          isClient: () => m,
          isIos: () => S,
          isServer: () => p,
          isTouchable: () => y,
          isWeb: () => d,
          isWebTouchable: () => g,
          isWindowDefined: () => f,
          useIsomorphicLayoutEffect: () => b,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(7527)
        const c = !!n(7527).use,
          d = !0,
          f = typeof window < 'u',
          p = d && !f,
          m = d && f,
          b = p ? u.useEffect : u.useLayoutEffect,
          h = typeof navigator < 'u' && /Chrome/.test(navigator.userAgent || ''),
          g = m && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
          y = !d || g,
          v = !1,
          S = 'ios' === { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TEST_NATIVE_PLATFORM,
          w = 'web'
      },
      1277: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let s of l(t))
                !i.call(e, s) &&
                  s !== n &&
                  o(e, s, { get: () => t[s], enumerable: !(r = a(t, s)) || r.enumerable })
            return e
          },
          u = {}
        ;((e.exports = ((r = u), s(o({}, '__esModule', { value: !0 }), r))),
          ((e, t, n) => {
            ;(s(e, t, 'default'), n && s(n, t, 'default'))
          })(u, n(6618), e.exports))
      },
      3511: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i() {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { addNativeValidStyles: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
      },
      1693: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i(e, t, n) {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { createOptimizedView: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
      },
      2592: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i() {
          return null
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { getBaseViews: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
      },
      4641: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let s of l(t))
                !i.call(e, s) &&
                  s !== n &&
                  o(e, s, { get: () => t[s], enumerable: !(r = a(t, s)) || r.enumerable })
            return e
          },
          u = (e, t, n) => (s(e, t, 'default'), n && s(n, t, 'default')),
          c = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(c, {
          Stack: () => w,
          TamaguiProvider: () => y,
          Text: () => O,
          View: () => S,
          createTamagui: () => v,
          setOnLayoutStrategy: () => h.setOnLayoutStrategy,
        }),
          (e.exports = ((r = c), s(o({}, '__esModule', { value: !0 }), r))),
          n(3961))
        var d = n(4394),
          f = n(9238),
          p = (n(7527), n(473)),
          m = n(3511),
          b = (n(1693), n(2592)),
          h = (n(4125), n(473))
        ;(u(c, n(9238), e.exports), u(c, n(7220), e.exports))
        var g = n(2351)
        ;(0, m.addNativeValidStyles)()
        const y = (e) => (
            (0, f.useIsomorphicLayoutEffect)(() => {
              ;(0, p.enable)()
            }, []),
            (0, g.jsx)(f.TamaguiProvider, { ...e })
          ),
          v = (e) => (0, f.createTamagui)(e)
        ;((0, b.getBaseViews)(),
          (0, f.setupHooks)({
            getBaseViews: b.getBaseViews,
            setElementProps: (e) => {
              e &&
                !e.measure &&
                ((e.measure ||= (t) => (0, p.measureLayout)(e, null, t)),
                (e.measureLayout ||= (t, n) => (0, p.measureLayout)(e, t, n)),
                (e.measureInWindow ||= (t) => {
                  setTimeout(() => {
                    const { height: n, left: r, top: o, width: a } = (0, p.getRect)(e)
                    t(r, o, a, n)
                  }, 0)
                }))
            },
            usePropsTransform(e, t, n, r) {
              {
                const o = 'string' == typeof e,
                  {
                    onMoveShouldSetResponder: a,
                    onMoveShouldSetResponderCapture: l,
                    onResponderEnd: i,
                    onResponderGrant: s,
                    onResponderMove: u,
                    onResponderReject: c,
                    onResponderRelease: f,
                    onResponderStart: m,
                    onResponderTerminate: b,
                    onResponderTerminationRequest: h,
                    onScrollShouldSetResponder: g,
                    onScrollShouldSetResponderCapture: y,
                    onSelectionChangeShouldSetResponder: v,
                    onSelectionChangeShouldSetResponderCapture: S,
                    onStartShouldSetResponder: w,
                    onStartShouldSetResponderCapture: O,
                    collapsable: k,
                    focusable: x,
                    accessible: P,
                    accessibilityDisabled: _,
                    onLayout: C,
                    hrefAttrs: E,
                    ...j
                  } = t
                if (
                  ((r || o) &&
                    ((0, p.useElementLayout)(n, o ? C : void 0),
                    (0, d.useResponderEvents)(n, o ? t : void 0)),
                  o)
                ) {
                  if (j.href && E) {
                    const { download: e, rel: t, target: n } = E
                    ;(null != e && (j.download = e),
                      t && (j.rel = t),
                      'string' == typeof n && (j.target = '_' !== n.charAt(0) ? `_${n}` : n))
                  }
                  return j
                }
              }
            },
            useEvents(e, t, { pseudos: n }, r, o) {},
          }))
        const S = f.View,
          w = f.Stack,
          O = f.Text
      },
      7220: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty
        e.exports =
          ((t = {}),
          ((e, t, l, i) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let l of o(t))
                !a.call(e, l) &&
                  undefined !== l &&
                  n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
            return e
          })(n({}, '__esModule', { value: !0 }), t))
      },
      4125: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { Pressability: () => i, usePressability: () => s }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = {},
          s = (e) => ({})
      },
      3296: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i(e, [t, n]) {
          return Math.min(n, Math.max(t, e))
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { clamp: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
      },
      9744: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i(e, t, { checkDefaultPrevented: n = !0 } = {}) {
          return e && t
            ? (r) => {
                if (
                  (e?.(r),
                  !r ||
                    !n ||
                    'object' != typeof r ||
                    !('defaultPrevented' in r) ||
                    ('defaultPrevented' in r && !r.defaultPrevented))
                )
                  return t?.(r)
              }
            : t || e || void 0
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { composeEventHandlers: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
      },
      9504: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i(e) {
          const t = arguments,
            n = []
          let r = '',
            o = null
          for (let e = t.length; e >= 0; e--) {
            const a = t[e]
            if (!a) continue
            if (!Array.isArray(a) && 'string' != typeof a) {
              ;((o = o || []), o.push(a))
              continue
            }
            const l = Array.isArray(a) ? a : a.split(' ')
            for (let e = l.length - 1; e >= 0; e--) {
              const t = l[e]
              if (!t || ' ' === t) continue
              if ('_' !== t[0]) {
                r = t + ' ' + r
                continue
              }
              const a = t.indexOf('-')
              if (a < 1) {
                r = t + ' ' + r
                continue
              }
              const i = '_' === t[a + 1],
                u = t.slice(1, t.lastIndexOf('-')),
                c = i ? t.slice(a + 2, a + 7) : null,
                d = c ? u + c : u
              if (n.indexOf(d) > -1) continue
              n.push(d)
              const f = u
              ;(f &&
                o &&
                o.some((e) => {
                  if (c) {
                    const t = s[c]
                    return e && e[t] && f in e[t] && null !== e[t]
                  }
                  return e && f in e && null !== e[f]
                })) ||
                (r = t + ' ' + r)
            }
          }
          return r
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { concatClassName: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const s = {
          hover: 'hoverStyle',
          focus: 'focusStyle',
          press: 'pressStyle',
          focusVisible: 'focusVisibleStyle',
          focusWithin: 'focusWithinStyle',
          disabled: 'disabledStyle',
        }
      },
      6013: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let s of l(t))
                !i.call(e, s) &&
                  s !== n &&
                  o(e, s, { get: () => t[s], enumerable: !(r = a(t, s)) || r.enumerable })
            return e
          },
          u = (e, t, n) => (s(e, t, 'default'), n && s(n, t, 'default')),
          c = {}
        ;((e.exports = ((r = c), s(o({}, '__esModule', { value: !0 }), r))),
          u(c, n(3749), e.exports),
          u(c, n(3296), e.exports),
          u(c, n(9744), e.exports),
          u(c, n(9504), e.exports),
          u(c, n(7482), e.exports),
          u(c, n(5358), e.exports),
          u(c, n(4916), e.exports),
          u(c, n(6654), e.exports))
      },
      5358: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { shouldRenderNativePlatform: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277)
        const c = ['web', 'android', 'ios']
        function d(e) {
          if (!e) return null
          const t = (function (e) {
            const t = !0 === e ? c : !1 === e ? [] : Array.isArray(e) ? e : [e],
              n = new Set(t)
            return (n.has('mobile') && (n.add('android'), n.add('ios'), n.delete('mobile')), n)
          })(e)
          for (const e of c) if (e === u.currentPlatform && t.has(e)) return e
          return null
        }
      },
      7482: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, {
          StyleObjectIdentifier: () => u,
          StyleObjectProperty: () => i,
          StyleObjectPseudo: () => c,
          StyleObjectRules: () => d,
          StyleObjectValue: () => s,
        }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = 0,
          s = 1,
          u = 2,
          c = 3,
          d = 4
      },
      4916: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          stylePropsAll: () => g,
          stylePropsText: () => h,
          stylePropsTextOnly: () => b,
          stylePropsTransform: () => p,
          stylePropsUnitless: () => f,
          stylePropsView: () => m,
          tokenCategories: () => d,
          validPseudoKeys: () => y,
          validStyles: () => v,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277)
        const c = { color: !0, textDecorationColor: !0, textShadowColor: !0 },
          d = {
            radius: {
              borderRadius: !0,
              borderTopLeftRadius: !0,
              borderTopRightRadius: !0,
              borderBottomLeftRadius: !0,
              borderBottomRightRadius: !0,
              borderStartStartRadius: !0,
              borderStartEndRadius: !0,
              borderEndStartRadius: !0,
              borderEndEndRadius: !0,
            },
            size: {
              width: !0,
              height: !0,
              minWidth: !0,
              minHeight: !0,
              maxWidth: !0,
              maxHeight: !0,
              blockSize: !0,
              minBlockSize: !0,
              maxBlockSize: !0,
              inlineSize: !0,
              minInlineSize: !0,
              maxInlineSize: !0,
            },
            zIndex: { zIndex: !0 },
            color: {
              backgroundColor: !0,
              borderColor: !0,
              borderBlockStartColor: !0,
              borderBlockEndColor: !0,
              borderBlockColor: !0,
              borderBottomColor: !0,
              borderInlineColor: !0,
              borderInlineStartColor: !0,
              borderInlineEndColor: !0,
              borderTopColor: !0,
              borderLeftColor: !0,
              borderRightColor: !0,
              borderEndColor: !0,
              borderStartColor: !0,
              shadowColor: !0,
              ...c,
              outlineColor: !0,
              caretColor: !0,
            },
          },
          f = {
            WebkitLineClamp: !0,
            animationIterationCount: !0,
            aspectRatio: !0,
            borderImageOutset: !0,
            borderImageSlice: !0,
            borderImageWidth: !0,
            columnCount: !0,
            flex: !0,
            flexGrow: !0,
            flexOrder: !0,
            flexPositive: !0,
            flexShrink: !0,
            flexNegative: !0,
            fontWeight: !0,
            gridRow: !0,
            gridRowEnd: !0,
            gridRowGap: !0,
            gridRowStart: !0,
            gridColumn: !0,
            gridColumnEnd: !0,
            gridColumnGap: !0,
            gridColumnStart: !0,
            gridTemplateColumns: !0,
            gridTemplateAreas: !0,
            lineClamp: !0,
            opacity: !0,
            order: !0,
            orphans: !0,
            tabSize: !0,
            widows: !0,
            zIndex: !0,
            zoom: !0,
            scale: !0,
            scaleX: !0,
            scaleY: !0,
            scaleZ: !0,
            shadowOpacity: !0,
          },
          p = {
            x: !0,
            y: !0,
            scale: !0,
            perspective: !0,
            scaleX: !0,
            scaleY: !0,
            skewX: !0,
            skewY: !0,
            matrix: !0,
            rotate: !0,
            rotateY: !0,
            rotateX: !0,
            rotateZ: !0,
          },
          m = {
            backfaceVisibility: !0,
            borderBottomEndRadius: !0,
            borderBottomStartRadius: !0,
            borderBottomWidth: !0,
            borderLeftWidth: !0,
            borderRightWidth: !0,
            borderBlockWidth: !0,
            borderBlockEndWidth: !0,
            borderBlockStartWidth: !0,
            borderInlineWidth: !0,
            borderInlineEndWidth: !0,
            borderInlineStartWidth: !0,
            borderStyle: !0,
            borderBlockStyle: !0,
            borderBlockEndStyle: !0,
            borderBlockStartStyle: !0,
            borderInlineStyle: !0,
            borderInlineEndStyle: !0,
            borderInlineStartStyle: !0,
            borderTopEndRadius: !0,
            borderTopStartRadius: !0,
            borderTopWidth: !0,
            borderWidth: !0,
            transform: !0,
            transformOrigin: !0,
            alignContent: !0,
            alignItems: !0,
            alignSelf: !0,
            borderEndWidth: !0,
            borderStartWidth: !0,
            bottom: !0,
            display: !0,
            end: !0,
            flexBasis: !0,
            flexDirection: !0,
            flexWrap: !0,
            gap: !0,
            columnGap: !0,
            rowGap: !0,
            justifyContent: !0,
            left: !0,
            margin: !0,
            marginBlock: !0,
            marginBlockEnd: !0,
            marginBlockStart: !0,
            marginInline: !0,
            marginInlineStart: !0,
            marginInlineEnd: !0,
            marginBottom: !0,
            marginEnd: !0,
            marginHorizontal: !0,
            marginLeft: !0,
            marginRight: !0,
            marginStart: !0,
            marginTop: !0,
            marginVertical: !0,
            overflow: !0,
            padding: !0,
            paddingBottom: !0,
            paddingInline: !0,
            paddingBlock: !0,
            paddingBlockStart: !0,
            paddingInlineEnd: !0,
            paddingInlineStart: !0,
            paddingEnd: !0,
            paddingHorizontal: !0,
            paddingLeft: !0,
            paddingRight: !0,
            paddingStart: !0,
            paddingTop: !0,
            paddingVertical: !0,
            position: !0,
            right: !0,
            start: !0,
            top: !0,
            inset: !0,
            insetBlock: !0,
            insetBlockEnd: !0,
            insetBlockStart: !0,
            insetInline: !0,
            insetInlineEnd: !0,
            insetInlineStart: !0,
            direction: !0,
            shadowOffset: !0,
            shadowRadius: !0,
            ...d.color,
            ...d.radius,
            ...d.size,
            ...d.radius,
            ...p,
            ...f,
            boxShadow: !0,
            filter: !0,
            transition: !0,
            textWrap: !0,
            backdropFilter: !0,
            WebkitBackdropFilter: !0,
            background: !0,
            backgroundAttachment: !0,
            backgroundBlendMode: !0,
            backgroundClip: !0,
            backgroundColor: !0,
            backgroundImage: !0,
            backgroundOrigin: !0,
            backgroundPosition: !0,
            backgroundRepeat: !0,
            backgroundSize: !0,
            borderBottomStyle: !0,
            borderImage: !0,
            borderLeftStyle: !0,
            borderRightStyle: !0,
            borderTopStyle: !0,
            boxSizing: !0,
            caretColor: !0,
            clipPath: !0,
            contain: !0,
            containerType: !0,
            content: !0,
            cursor: !0,
            float: !0,
            mask: !0,
            maskBorder: !0,
            maskBorderMode: !0,
            maskBorderOutset: !0,
            maskBorderRepeat: !0,
            maskBorderSlice: !0,
            maskBorderSource: !0,
            maskBorderWidth: !0,
            maskClip: !0,
            maskComposite: !0,
            maskImage: !0,
            maskMode: !0,
            maskOrigin: !0,
            maskPosition: !0,
            maskRepeat: !0,
            maskSize: !0,
            maskType: !0,
            mixBlendMode: !0,
            objectFit: !0,
            objectPosition: !0,
            outlineOffset: !0,
            outlineStyle: !0,
            outlineWidth: !0,
            overflowBlock: !0,
            overflowInline: !0,
            overflowX: !0,
            overflowY: !0,
            pointerEvents: !0,
            scrollbarWidth: !0,
            textEmphasis: !0,
            touchAction: !0,
            transformStyle: !0,
            userSelect: !0,
            ...(u.isAndroid ? { elevationAndroid: !0 } : {}),
          },
          b = {
            fontFamily: !0,
            fontSize: !0,
            fontStyle: !0,
            fontWeight: !0,
            fontVariant: !0,
            letterSpacing: !0,
            lineHeight: !0,
            textTransform: !0,
            textAlign: !0,
            textDecorationLine: !0,
            textDecorationStyle: !0,
            ...c,
            textShadowOffset: !0,
            textShadowRadius: !0,
            userSelect: !0,
            selectable: !0,
            verticalAlign: !0,
            whiteSpace: !0,
            wordWrap: !0,
            textOverflow: !0,
            textDecorationDistance: !0,
            cursor: !0,
            WebkitLineClamp: !0,
            WebkitBoxOrient: !0,
          },
          h = { ...m, ...b },
          g = h,
          y = {
            enterStyle: !0,
            exitStyle: !0,
            hoverStyle: !0,
            pressStyle: !0,
            focusStyle: !0,
            disabledStyle: !0,
            focusWithinStyle: !0,
            focusVisibleStyle: !0,
          },
          v = m
      },
      6654: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { withStaticProperties: () => m }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = ((e, t, n) => (
          (n = null != e ? o(s(e)) : {}),
          c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
        ))(n(7527))
        const p = Symbol(),
          m = (e, t) => {
            const n = (() => {
              if (e[p]) {
                const t = f.default.forwardRef((t, n) =>
                  f.default.createElement(e, { ...t, ref: n })
                )
                for (const n in e) {
                  const r = e[n]
                  t[n] = r && 'object' == typeof r ? { ...r } : r
                }
              }
              return e
            })()
            return (Object.assign(n, t), (n[p] = !0), n)
          }
      },
      9478: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          isEqualShallow: () => f,
          mergeIfNotShallowEqual: () => d,
          useCreateShallowSetState: () => c,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(7527)
        function c(e, t) {
          return (0, u.useCallback)(
            (t) => {
              e((e) => d(e, t))
            },
            [e, t]
          )
        }
        function d(e, t, n) {
          return e && t && !f(e, t) ? { ...e, ...t } : e || t
        }
        function f(e, t) {
          for (const n in t) if (e[n] !== t[n]) return !1
          return !0
        }
      },
      5307: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { default: () => h, normalizeCSSColor: () => m, rgba: () => b }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = ((e, t, n) => (
          (n = null != e ? o(s(e)) : {}),
          c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
        ))(n(9899))
        const p = f.default || f,
          m = p
        function b(e) {
          return {
            r: Math.round((4278190080 & e) >>> 24),
            g: Math.round((16711680 & e) >>> 16),
            b: Math.round((65280 & e) >>> 8),
            a: ((255 & e) >>> 0) / 255,
          }
        }
        var h = p
      },
      6345: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { createMedia: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(9238),
          c = n(4778)
        function d(e) {
          return ((0, u.setupMatchMedia)(c.matchMedia), e)
        }
      },
      3961: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let s of l(t))
                !i.call(e, s) &&
                  s !== n &&
                  o(e, s, { get: () => t[s], enumerable: !(r = a(t, s)) || r.enumerable })
            return e
          },
          u = (e, t, n) => (s(e, t, 'default'), n && s(n, t, 'default')),
          c = {}
        ;((e.exports = ((r = c), s(o({}, '__esModule', { value: !0 }), r))),
          u(c, n(6345), e.exports),
          u(c, n(4778), e.exports))
      },
      4778: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { matchMedia: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = globalThis.matchMedia
      },
      6019: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, {
          addNode: () => A,
          attachListeners: () => M,
          getResponderNode: () => I,
          removeNode: () => D,
          terminateResponder: () => z,
        }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(9732)),
          p = n(4022),
          m = n(2705),
          b = n(826),
          h = n(826)
        const g = {},
          y = ['onStartShouldSetResponderCapture', 'onStartShouldSetResponder', { bubbles: !0 }],
          v = ['onMoveShouldSetResponderCapture', 'onMoveShouldSetResponder', { bubbles: !0 }],
          S = {
            touchstart: y,
            mousedown: y,
            touchmove: v,
            mousemove: v,
            scroll: [
              'onScrollShouldSetResponderCapture',
              'onScrollShouldSetResponder',
              { bubbles: !1 },
            ],
          },
          w = { id: null, idPath: null, node: null },
          O = new Map()
        let k = !1,
          x = 0,
          P = { id: null, node: null, idPath: null }
        const _ = new p.ResponderTouchHistoryStore()
        function C(e) {
          P = e
        }
        function E(e) {
          return O.get(e) ?? g
        }
        function j(e) {
          const t = e.type,
            n = e.target
          if (
            ('touchstart' === t && (k = !0),
            ('touchmove' === t || x > 1) && (k = !1),
            ('mousedown' === t && k) || ('mousemove' === t && k) || ('mousemove' === t && x < 1))
          )
            return
          if (k && 'mouseup' === t) return void (0 === x && (k = !1))
          const r = (0, m.isStartish)(t) && (0, h.isPrimaryPointerDown)(e),
            o = (0, m.isMoveish)(t),
            a = (0, m.isEndish)(t),
            l = (0, m.isScroll)(t),
            i = (0, m.isSelectionChange)(t),
            s = (0, f.default)(e, _)
          ;(r || o || a) &&
            (e.touches ? (x = e.touches.length) : r ? (x = 1) : a && (x = 0),
            _.recordTouchTrack(t, s.nativeEvent))
          let u,
            c = (0, h.getResponderPaths)(e),
            d = !1
          if (r || o || (l && x > 0)) {
            const t = P.idPath,
              n = c.idPath
            if (null != t && null != n) {
              const e = (0, h.getLowestCommonAncestor)(t, n)
              if (null != e) {
                const t = n.indexOf(e) + (e === P.id ? 1 : 0)
                c = { idPath: n.slice(t), nodePath: c.nodePath.slice(t) }
              } else c = null
            }
            null != c &&
              ((u = (function (e, t, n) {
                const r = S[t.type]
                if (null != r) {
                  const { idPath: o, nodePath: a } = e,
                    l = r[0],
                    i = r[1],
                    { bubbles: s } = r[2],
                    u = (e, t, r) => {
                      const a = E(e)[r]
                      if (null != a && ((n.currentTarget = t), !0 === a(n)))
                        return { id: e, node: t, idPath: o.slice(o.indexOf(e)) }
                    }
                  for (let e = o.length - 1; e >= 0; e--) {
                    const t = u(o[e], a[e], l)
                    if (null != t) return t
                    if (!0 === n.isPropagationStopped()) return
                  }
                  if (s)
                    for (let e = 0; e < o.length; e++) {
                      const t = u(o[e], a[e], i)
                      if (null != t) return t
                      if (!0 === n.isPropagationStopped()) return
                    }
                  else {
                    const e = o[0],
                      n = a[0]
                    if (t.target === n) return u(e, n, i)
                  }
                }
              })(c, e, s)),
              null != u &&
                ((function (e, t) {
                  const { id: n, node: r } = P,
                    { id: o, node: a } = t,
                    { onResponderGrant: l, onResponderReject: i } = E(o)
                  if (((e.bubbles = !1), (e.cancelable = !1), (e.currentTarget = a), null == n))
                    (null != l &&
                      ((e.currentTarget = a),
                      (e.dispatchConfig.registrationName = 'onResponderGrant'),
                      l(e)),
                      C(t))
                  else {
                    const { onResponderTerminate: o, onResponderTerminationRequest: s } = E(n)
                    let u = !0
                    ;(null != s &&
                      ((e.currentTarget = r),
                      (e.dispatchConfig.registrationName = 'onResponderTerminationRequest'),
                      !1 === s(e) && (u = !1)),
                      u
                        ? (null != o &&
                            ((e.currentTarget = r),
                            (e.dispatchConfig.registrationName = 'onResponderTerminate'),
                            o(e)),
                          null != l &&
                            ((e.currentTarget = a),
                            (e.dispatchConfig.registrationName = 'onResponderGrant'),
                            l(e)),
                          C(t))
                        : null != i &&
                          ((e.currentTarget = a),
                          (e.dispatchConfig.registrationName = 'onResponderReject'),
                          i(e)))
                  }
                })(s, u),
                (d = !0)))
          }
          if (null != P.id && null != P.node) {
            const { id: u, node: c } = P,
              {
                onResponderStart: f,
                onResponderMove: p,
                onResponderEnd: b,
                onResponderRelease: g,
                onResponderTerminate: y,
                onResponderTerminationRequest: v,
              } = E(u)
            if (((s.bubbles = !1), (s.cancelable = !1), (s.currentTarget = c), r))
              null != f && ((s.dispatchConfig.registrationName = 'onResponderStart'), f(s))
            else if (o) null != p && ((s.dispatchConfig.registrationName = 'onResponderMove'), p(s))
            else {
              const r =
                  (0, m.isCancelish)(t) ||
                  'contextmenu' === t ||
                  ('blur' === t && n === window) ||
                  ('blur' === t && n.contains(c) && e.relatedTarget !== c) ||
                  (l && 0 === x) ||
                  (l && n.contains(c) && n !== c) ||
                  (i && (0, h.hasValidSelection)(e)),
                o = a && !r && !(0, h.hasTargetTouches)(c, e.touches)
              if (
                (a && null != b && ((s.dispatchConfig.registrationName = 'onResponderEnd'), b(s)),
                o &&
                  (null != g && ((s.dispatchConfig.registrationName = 'onResponderRelease'), g(s)),
                  C(w)),
                r)
              ) {
                let e = !0
                ;(('contextmenu' === t || 'scroll' === t || 'selectionchange' === t) &&
                  (d
                    ? (e = !1)
                    : null != v &&
                      ((s.dispatchConfig.registrationName = 'onResponderTerminationRequest'),
                      !1 === v(s) && (e = !1))),
                  e &&
                    (null != y &&
                      ((s.dispatchConfig.registrationName = 'onResponderTerminate'), y(s)),
                    C(w),
                    (k = !1),
                    (x = 0)))
              }
            }
          }
        }
        const T = ['blur', 'scroll'],
          R = [
            'mousedown',
            'mousemove',
            'mouseup',
            'dragstart',
            'touchstart',
            'touchmove',
            'touchend',
            'touchcancel',
            'contextmenu',
            'select',
            'selectionchange',
          ],
          N = Symbol()
        function M() {
          b.canUseDOM &&
            !window[N] &&
            (window.addEventListener('blur', j),
            R.forEach((e) => {
              document.addEventListener(e, j)
            }),
            T.forEach((e) => {
              document.addEventListener(e, j, !0)
            }),
            (window[N] = !0))
        }
        function A(e, t, n) {
          ;((0, h.setResponderId)(t, e), O.set(e, n))
        }
        function D(e) {
          ;(P.id === e && z(), O.has(e) && O.delete(e))
        }
        function z() {
          const { id: e, node: t } = P
          if (null != e && null != t) {
            const { onResponderTerminate: n } = E(e)
            if (null != n) {
              const e = (0, f.default)({}, _)
              ;((e.currentTarget = t), n(e))
            }
            C(w)
          }
          ;((k = !1), (x = 0))
        }
        function I() {
          return P.node
        }
      },
      4022: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { ResponderTouchHistoryStore: () => c }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(2705)
        class c {
          _touchHistory = {
            touchBank: [],
            numberActiveTouches: 0,
            indexOfSingleActiveTouch: -1,
            mostRecentTimeStamp: 0,
          }
          recordTouchTrack(e, t) {
            const n = this._touchHistory
            if ((0, u.isMoveish)(e))
              t.changedTouches.forEach((e) =>
                (function (e, t) {
                  const n = t.touchBank[p(e)]
                  n
                    ? ((n.touchActive = !0),
                      (n.previousPageX = n.currentPageX),
                      (n.previousPageY = n.currentPageY),
                      (n.previousTimeStamp = n.currentTimeStamp),
                      (n.currentPageX = e.pageX),
                      (n.currentPageY = e.pageY),
                      (n.currentTimeStamp = f(e)),
                      (t.mostRecentTimeStamp = f(e)))
                    : console.warn(
                        'Cannot record touch move without a touch start.\n',
                        `Touch Move: ${m(e)}\n`,
                        `Touch Bank: ${b(t)}`
                      )
                })(e, n)
              )
            else if ((0, u.isStartish)(e))
              (t.changedTouches.forEach((e) =>
                (function (e, t) {
                  const n = p(e),
                    r = t.touchBank[n]
                  ;(r
                    ? (function (e, t) {
                        ;((e.touchActive = !0),
                          (e.startPageX = t.pageX),
                          (e.startPageY = t.pageY),
                          (e.startTimeStamp = f(t)),
                          (e.currentPageX = t.pageX),
                          (e.currentPageY = t.pageY),
                          (e.currentTimeStamp = f(t)),
                          (e.previousPageX = t.pageX),
                          (e.previousPageY = t.pageY),
                          (e.previousTimeStamp = f(t)))
                      })(r, e)
                    : (t.touchBank[n] = (function (e) {
                        return {
                          touchActive: !0,
                          startPageX: e.pageX,
                          startPageY: e.pageY,
                          startTimeStamp: f(e),
                          currentPageX: e.pageX,
                          currentPageY: e.pageY,
                          currentTimeStamp: f(e),
                          previousPageX: e.pageX,
                          previousPageY: e.pageY,
                          previousTimeStamp: f(e),
                        }
                      })(e)),
                    (t.mostRecentTimeStamp = f(e)))
                })(e, n)
              ),
                (n.numberActiveTouches = t.touches.length),
                1 === n.numberActiveTouches &&
                  (n.indexOfSingleActiveTouch = t.touches[0].identifier))
            else if (
              (0, u.isEndish)(e) &&
              (t.changedTouches.forEach((e) =>
                (function (e, t) {
                  const n = t.touchBank[p(e)]
                  n
                    ? ((n.touchActive = !1),
                      (n.previousPageX = n.currentPageX),
                      (n.previousPageY = n.currentPageY),
                      (n.previousTimeStamp = n.currentTimeStamp),
                      (n.currentPageX = e.pageX),
                      (n.currentPageY = e.pageY),
                      (n.currentTimeStamp = f(e)),
                      (t.mostRecentTimeStamp = f(e)))
                    : console.warn(
                        'Cannot record touch end without a touch start.\n',
                        `Touch End: ${m(e)}\n`,
                        `Touch Bank: ${b(t)}`
                      )
                })(e, n)
              ),
              (n.numberActiveTouches = t.touches.length),
              1 === n.numberActiveTouches)
            ) {
              const { touchBank: e } = n
              for (let t = 0; t < e.length; t++)
                if (e[t]?.touchActive) {
                  n.indexOfSingleActiveTouch = t
                  break
                }
            }
          }
          get touchHistory() {
            return this._touchHistory
          }
        }
        const d = 20
        function f(e) {
          return e.timeStamp || e.timestamp
        }
        function p({ identifier: e }) {
          return (null == e && console.error('Touch object is missing identifier.'), e)
        }
        function m(e) {
          return JSON.stringify({
            identifier: e.identifier,
            pageX: e.pageX,
            pageY: e.pageY,
            timestamp: f(e),
          })
        }
        function b(e) {
          const { touchBank: t } = e
          let n = JSON.stringify(t.slice(0, d))
          return (t.length > d && (n += ` (original size: ${t.length})`), n)
        }
      },
      9732: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { default: () => m }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(826)
        const c = () => {},
          d = {},
          f = []
        function p(e) {
          return e > 20 ? e % 20 : e
        }
        function m(e, t) {
          let n,
            r,
            o,
            a = !1
          const l = e.changedTouches,
            i = e.type,
            s = !0 === e.metaKey,
            m = !0 === e.shiftKey,
            b = l?.[0].force || 0,
            h = p(l?.[0].identifier || 0),
            g = l?.[0].clientX || e.clientX,
            y = l?.[0].clientY || e.clientY,
            v = l?.[0].pageX || e.pageX,
            S = l?.[0].pageY || e.pageY,
            w = 'function' == typeof e.preventDefault ? e.preventDefault.bind(e) : c,
            O = e.timeStamp
          function k(e) {
            return Array.prototype.slice.call(e).map((e) => ({
              force: e.force,
              identifier: p(e.identifier),
              get locationX() {
                return P(e.clientX)
              },
              get locationY() {
                return _(e.clientY)
              },
              pageX: e.pageX,
              pageY: e.pageY,
              target: e.target,
              timestamp: O,
            }))
          }
          if (null != l) ((r = k(l)), (o = k(e.touches)))
          else {
            const t = [
              {
                force: b,
                identifier: h,
                get locationX() {
                  return P(g)
                },
                get locationY() {
                  return _(y)
                },
                pageX: v,
                pageY: S,
                target: e.target,
                timestamp: O,
              },
            ]
            ;((r = t), (o = 'mouseup' === i || 'dragstart' === i ? f : t))
          }
          const x = {
            bubbles: !0,
            cancelable: !0,
            currentTarget: null,
            defaultPrevented: e.defaultPrevented,
            dispatchConfig: d,
            eventPhase: e.eventPhase,
            isDefaultPrevented: () => e.defaultPrevented,
            isPropagationStopped: () => a,
            isTrusted: e.isTrusted,
            nativeEvent: {
              altKey: !1,
              ctrlKey: !1,
              metaKey: s,
              shiftKey: m,
              changedTouches: r,
              force: b,
              identifier: h,
              get locationX() {
                return P(g)
              },
              get locationY() {
                return _(y)
              },
              pageX: v,
              pageY: S,
              target: e.target,
              timestamp: O,
              touches: o,
              type: i,
            },
            persist: c,
            preventDefault: w,
            stopPropagation() {
              a = !0
            },
            target: e.target,
            timeStamp: O,
            touchHistory: t.touchHistory,
          }
          function P(e) {
            if (((n = n || (0, u.getBoundingClientRect)(x.currentTarget)), n)) return e - n.left
          }
          function _(e) {
            if (((n = n || (0, u.getBoundingClientRect)(x.currentTarget)), n)) return e - n.top
          }
          return x
        }
      },
      4394: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let s of l(t))
                !i.call(e, s) &&
                  s !== n &&
                  o(e, s, { get: () => t[s], enumerable: !(r = a(t, s)) || r.enumerable })
            return e
          },
          u = {}
        ;((e.exports = ((r = u), s(o({}, '__esModule', { value: !0 }), r))),
          ((e, t, n) => {
            ;(s(e, t, 'default'), n && s(n, t, 'default'))
          })(u, n(5568), e.exports))
      },
      2705: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, {
          BLUR: () => i,
          CONTEXT_MENU: () => s,
          FOCUS_OUT: () => u,
          MOUSE_CANCEL: () => p,
          MOUSE_DOWN: () => c,
          MOUSE_MOVE: () => d,
          MOUSE_UP: () => f,
          SCROLL: () => y,
          SELECT: () => v,
          SELECTION_CHANGE: () => S,
          TOUCH_CANCEL: () => g,
          TOUCH_END: () => h,
          TOUCH_MOVE: () => b,
          TOUCH_START: () => m,
          isCancelish: () => x,
          isEndish: () => k,
          isMoveish: () => O,
          isScroll: () => P,
          isSelectionChange: () => _,
          isStartish: () => w,
        }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = 'blur',
          s = 'contextmenu',
          u = 'focusout',
          c = 'mousedown',
          d = 'mousemove',
          f = 'mouseup',
          p = 'dragstart',
          m = 'touchstart',
          b = 'touchmove',
          h = 'touchend',
          g = 'touchcancel',
          y = 'scroll',
          v = 'select',
          S = 'selectionchange'
        function w(e) {
          return e === m || e === c
        }
        function O(e) {
          return e === b || e === d
        }
        function k(e) {
          return e === h || e === f || x(e)
        }
        function x(e) {
          return e === g || e === p
        }
        function P(e) {
          return e === y
        }
        function _(e) {
          return e === v || e === S
        }
      },
      5568: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = (e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(!t && e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ),
          f = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(f, { getResponderConfigIfDefined: () => v, useResponderEvents: () => y }),
          (e.exports = ((r = f), c(a({}, '__esModule', { value: !0 }), r))))
        var p = d(n(7527)),
          m = d(n(6019))
        ;((e, t, n) => {
          ;(c(e, t, 'default'), n && c(n, t, 'default'))
        })(f, n(826), e.exports)
        const b = {},
          h = new WeakMap(),
          g = new WeakMap()
        function y(e, t = b) {
          const n = v(t),
            r = e?.current?.host || e?.current
          p.useEffect(() => {
            if (n === b) return
            ;(m.attachListeners(), g.has(e) || g.set(e, `${Math.random()}`))
            const t = g.get(e)
            return (
              m.addNode(t, r, n),
              h.set(e, !0),
              () => {
                ;(m.removeNode(r), h.set(e, !1))
              }
            )
          }, [n, e])
        }
        function v({
          onMoveShouldSetResponder: e,
          onMoveShouldSetResponderCapture: t,
          onResponderEnd: n,
          onResponderGrant: r,
          onResponderMove: o,
          onResponderReject: a,
          onResponderRelease: l,
          onResponderStart: i,
          onResponderTerminate: s,
          onResponderTerminationRequest: u,
          onScrollShouldSetResponder: c,
          onScrollShouldSetResponderCapture: d,
          onSelectionChangeShouldSetResponder: f,
          onSelectionChangeShouldSetResponderCapture: p,
          onStartShouldSetResponder: m,
          onStartShouldSetResponderCapture: h,
        }) {
          return e || t || n || r || o || a || l || i || s || u || c || d || f || p || m || h
            ? {
                onMoveShouldSetResponder: e,
                onMoveShouldSetResponderCapture: t,
                onResponderEnd: n,
                onResponderGrant: r,
                onResponderMove: o,
                onResponderReject: a,
                onResponderRelease: l,
                onResponderStart: i,
                onResponderTerminate: s,
                onResponderTerminationRequest: u,
                onScrollShouldSetResponder: c,
                onScrollShouldSetResponderCapture: d,
                onSelectionChangeShouldSetResponder: f,
                onSelectionChangeShouldSetResponderCapture: p,
                onStartShouldSetResponder: m,
                onStartShouldSetResponderCapture: h,
              }
            : b
        }
      },
      826: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, {
          canUseDOM: () => s,
          getBoundingClientRect: () => u,
          getLowestCommonAncestor: () => m,
          getResponderPaths: () => p,
          hasTargetTouches: () => b,
          hasValidSelection: () => h,
          isPrimaryPointerDown: () => g,
          isSelectionValid: () => y,
          setResponderId: () => f,
        }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = '__reactResponderId',
          s = !!(typeof window < 'u' && window.document && window.document.createElement),
          u = (e) => {
            if (e && 1 === e.nodeType && e.getBoundingClientRect) return e.getBoundingClientRect()
          }
        function c(e) {
          const t = []
          for (; null != e && e !== document.body; ) (t.push(e), (e = e.parentNode))
          return t
        }
        function d(e) {
          return null != e ? e[i] : null
        }
        function f(e, t) {
          null != e && (e[i] = t)
        }
        function p(e) {
          const t = [],
            n = [],
            r = (function (e) {
              if ('selectionchange' === e.type) {
                const e = window.getSelection()?.anchorNode
                return c(e)
              }
              return null != e.composedPath ? e.composedPath() : c(e.target)
            })(e)
          for (let e = 0; e < r.length; e++) {
            const o = r[e],
              a = d(o)
            null != a && (t.push(a), n.push(o))
          }
          return { idPath: t, nodePath: n }
        }
        function m(e, t) {
          let n = e.length,
            r = t.length
          if (0 === n || 0 === r || e[n - 1] !== t[r - 1]) return null
          let o = e[0],
            a = 0,
            l = t[0],
            i = 0
          ;(n - r > 0 && ((a = n - r), (o = e[a]), (n = r)),
            r - n > 0 && ((i = r - n), (l = t[i]), (r = n)))
          let s = n
          for (; s--; ) {
            if (o === l) return o
            ;((o = e[a++]), (l = t[i++]))
          }
          return null
        }
        function b(e, t) {
          if (!t || 0 === t.length) return !1
          for (let n = 0; n < t.length; n++) {
            const r = t[n].target
            if (null != r && e.contains(r)) return !0
          }
          return !1
        }
        function h(e) {
          return 'selectionchange' === e.type ? y() : 'select' === e.type
        }
        function g(e) {
          const { altKey: t, button: n, buttons: r, ctrlKey: o, type: a } = e,
            l = !1 === t && !1 === o
          return !!(
            'touchstart' === a ||
            'touchmove' === a ||
            ('mousedown' === a && (0 === n || 1 === r) && l) ||
            ('mousemove' === a && 1 === r && l)
          )
        }
        function y() {
          const e = window.getSelection()
          if (!e) return !1
          const t = e.toString(),
            n = e.anchorNode,
            r = e.focusNode,
            o =
              (n && n.nodeType === window.Node.TEXT_NODE) ||
              (r && r.nodeType === window.Node.TEXT_NODE)
          return t.length >= 1 && '\n' !== t && !!o
        }
      },
      3749: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { simpleHash: () => u }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = new Map()
        let s = 0
        const u = (e, t = 10) => {
            if (i.has(e)) return i.get(e)
            let n = e
            'v' === n[0] && n.startsWith('var(') && (n = n.slice(6, n.length - 1))
            let r = 0,
              o = '',
              a = 0
            const l = n.length
            for (let e = 0; e < l; e++) {
              if ('strict' !== t && a <= t) {
                const t = n.charCodeAt(e)
                if (46 === t) {
                  o += '--'
                  continue
                }
                if (
                  ((u = t) >= 65 && u <= 90) ||
                  (u >= 97 && u <= 122) ||
                  95 === u ||
                  45 === u ||
                  (u >= 48 && u <= 57)
                ) {
                  ;(a++, (o += n[e]))
                  continue
                }
              }
              r = c(r, n[e])
            }
            var u
            const d = o + (r ? Math.abs(r) : '')
            return (s > 1e4 && (i.clear(), (s = 0)), i.set(e, d), s++, d)
          },
          c = (e, t) => (Math.imul(31, e) + t.charCodeAt(0)) | 0
      },
      3265: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { ClientOnly: () => f, ClientOnlyContext: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(7527),
          c = n(2351)
        const d = (0, u.createContext)(!1),
          f = ({ children: e }) => (0, c.jsx)(d.Provider, { value: !0, children: e })
      },
      1330: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, {
          ClientOnly: () => m.ClientOnly,
          ClientOnlyContext: () => m.ClientOnlyContext,
          useClientValue: () => y,
          useDidFinishSSR: () => h,
          useIsClientOnly: () => b,
        }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          p = n(3265),
          m = n(3265)
        const b = () => f.useContext(p.ClientOnlyContext)
        function h(e) {
          return f.useContext(p.ClientOnlyContext)
            ? (e ?? !0)
            : f.useSyncExternalStore(
                g,
                () => e ?? !0,
                () => !1
              )
        }
        const g = () => () => {}
        function y(e) {
          return h() ? ('function' == typeof e ? e() : e) : void 0
        }
      },
      473: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          enable: () => w,
          getElementLayoutEvent: () => O,
          getElementLayoutEventAsync: () => x,
          getRect: () => j,
          measureLayout: () => k,
          measureLayoutAsync: () => P,
          setOnLayoutStrategy: () => m,
          useElementLayout: () => C,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(9478)
        const d = new WeakMap(),
          f = new Set()
        let p = 'async'
        function m(e) {
          p = e
        }
        const b = new WeakMap(),
          h = new WeakMap(),
          g = new WeakMap(),
          y = typeof window < 'u' ? window.requestAnimationFrame : void 0
        let v = !0
        const S = new Map()
        function w() {
          v && ((v = !1), S && (S.forEach((e) => e()), S.clear()))
        }
        if (u.isClient && y) {
          let e = function () {
              const o = Date.now(),
                a = o - t
              if (((t = o), n < r)) return (n++, void y(e))
              ;((n = 0),
                'off' !== p &&
                  (a > 16.67 * 10 ||
                    f.forEach((e) => {
                      !(async function (e, n) {
                        const r = d.get(e)
                        if ('function' != typeof r) return
                        const o = e.parentElement
                        if (!o) return
                        let a, l
                        if ('async' === p) {
                          const [r, i] = await Promise.all([E(e), E(o)])
                          if (n !== t) return
                          ;((a = r), (l = i))
                        } else ((a = e.getBoundingClientRect()), (l = o.getBoundingClientRect()))
                        const i = b.get(e),
                          s = b.get(o)
                        if (
                          !i ||
                          !((0, c.isEqualShallow)(i, a) || (s && (0, c.isEqualShallow)(s, l)))
                        ) {
                          ;(b.set(e, a), h.set(o, l))
                          const t = O(a, l)
                          v ? S.set(e, () => r(t)) : r(t)
                        }
                      })(e, t)
                    })),
                y(e))
            },
            t = Date.now()
          y(e)
          let n = 0
          const r = 6
        }
        const O = (e, t) => ({
            nativeEvent: { layout: _(e, t), target: e },
            timeStamp: Date.now(),
          }),
          k = (e, t, n) => {
            const r = t || e?.parentElement
            if (r instanceof HTMLElement) {
              const t = e.getBoundingClientRect(),
                o = r.getBoundingClientRect()
              if (o && t) {
                const { x: e, y: r, width: a, height: l, left: i, top: s } = _(t, o)
                n(e, r, a, l, i, s)
              }
            }
          },
          x = async (e) => {
            const t = await P(e)
            if (!t) throw new Error('‼️')
            return { nativeEvent: { layout: t, target: e }, timeStamp: Date.now() }
          },
          P = async (e, t) => {
            const n = t || e?.parentElement
            if (n instanceof HTMLElement) {
              const [t, r] = await Promise.all([E(e), E(n)])
              if (r && t) {
                const { x: e, y: n, width: o, height: a, left: l, top: i } = _(t, r)
                return { x: e, y: n, width: o, height: a, left: l, top: i }
              }
            }
            return null
          },
          _ = (e, t) => {
            const { height: n, left: r, top: o, width: a } = e
            return { x: r - t.left, y: o - t.top, width: a, height: n, left: r, top: o }
          }
        function C(e, t) {
          const n = (function (e) {
            if (!(typeof HTMLElement > 'u')) return e instanceof HTMLElement ? e : void 0
          })(e.current?.host)
          ;(n && t && d.set(n, t),
            (0, u.useIsomorphicLayoutEffect)(() => {
              if (!t) return
              const n = e.current?.host
              if (!n) return
              ;(d.set(n, t), f.add(n))
              const r = n.parentNode
              return (
                r && t(O(n.getBoundingClientRect(), r.getBoundingClientRect())),
                () => {
                  ;(f.delete(n), d.delete(n), b.delete(n), g.delete(n))
                }
              )
            }, [e, !!t]))
        }
        const E = (e) =>
            new Promise((t) => {
              if (!e || 1 !== e.nodeType) return
              const n = new IntersectionObserver(
                (e) => (n.disconnect(), t(e[0].boundingClientRect)),
                { threshold: 0 }
              )
              n.observe(e)
            }),
          j = (e) => {
            const t = ((e) => {
              if (e && 1 === e.nodeType) return e.getBoundingClientRect?.()
            })(e)
            if (!t) return
            const { x: n, y: r, top: o, left: a } = t
            return { x: n, y: r, width: e.offsetWidth, height: e.offsetHeight, top: o, left: a }
          }
      },
      5946: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let s of l(t))
                !i.call(e, s) &&
                  s !== n &&
                  o(e, s, { get: () => t[s], enumerable: !(r = a(t, s)) || r.enumerable })
            return e
          },
          u = (e, t, n) => (s(e, t, 'default'), n && s(n, t, 'default')),
          c = {}
        ;((e.exports = ((r = c), s(o({}, '__esModule', { value: !0 }), r))),
          u(c, n(6045), e.exports),
          u(c, n(4581), e.exports))
      },
      6045: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { useEvent: () => c }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(4581)
        function c(e) {
          return (0, u.useGet)(e, d, !0)
        }
        const d = () => {
          throw new Error('Cannot call an event handler while rendering.')
        }
      },
      4581: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { useGet: () => m }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = n(1277),
          p = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527))
        function m(e, t, n) {
          const r = p.useRef(t ?? e)
          return (
            (0, f.useIsomorphicLayoutEffect)(() => {
              r.current = e
            }),
            p.useCallback(n ? (...e) => r.current?.apply(null, e) : () => r.current, [])
          )
        }
      },
      8746: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { Tamagui: () => f, getValueFromIdentifier: () => m, setIdentifierValue: () => b }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))),
          ((e, t, n) => {
            ;((n = null != e ? o(s(e)) : {}),
              c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e))
          })(n(6013)),
          n(2544),
          n(1364),
          n(3750))
        const f = void 0,
          p = new Map(),
          m = (e) => p.get(e),
          b = (e, t) => {
            p.set(e, t)
          }
      },
      8243: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { _withStableStyle: () => b }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          p = n(5873),
          m = n(2351)
        const b = (e, t) =>
          f.default.forwardRef((n, r) => {
            const { _expressions: o = [], ...a } = n,
              l = (0, p.useTheme)()
            return (0, m.jsx)(e, { ref: r, style: t(l, o), ...a })
          })
      },
      2544: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          configListeners: () => x,
          devConfig: () => {},
          getConfig: () => m,
          getConfigMaybe: () => b,
          getFont: () => C,
          getSetting: () => d,
          getThemes: () => k,
          getToken: () => S,
          getTokenObject: () => v,
          getTokenValue: () => w,
          getTokens: () => y,
          onConfiguredOnce: () => P,
          setConfig: () => f,
          setConfigFont: () => p,
          setTokens: () => g,
          setupDev: () => E,
          updateConfig: () => _,
          useTokens: () => O,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277)
        let c
        n(9991)
        const d = (e) => c.settings[e] ?? c[e],
          f = (e) => {
            c = e
          },
          p = (e, t, n) => {
            ;((c.fonts[e] = t), (c.fontsParsed[`$${e}`] = n))
          },
          m = () => {
            if (!c) throw new Error('Err0')
            return c
          },
          b = () => c
        let h
        function g(e) {
          h = e
        }
        const y = ({ prefixed: e } = {}) => {
            const { tokens: t, tokensParsed: n } = c
            return !1 === e ? t : !0 === e ? n : h
          },
          v = (e, t) =>
            c.specificTokens[e] ??
            (t ? h[t]?.[e] : h[Object.keys(h).find((t) => h[t][e]) || '']?.[e]),
          S = (e, t, n = u.isWeb) => {
            const r = v(e, t)
            return n ? r?.variable : r?.val
          },
          w = (e, t) => {
            if ('unset' !== e && 'auto' !== e) return S(e, t, !1)
          },
          O = y,
          k = () => c.themes,
          x = new Set(),
          P = (e) => {
            c ? e(c) : x.add(e)
          },
          _ = (e, t) => {
            Object.assign(c[e], t)
          },
          C = (e) => {
            const t = m()
            return (
              t.fontsParsed[e] ??
              Object.entries(t.fontsParsed).find(([n]) => t.fontsParsed[n]?.family?.val === e)?.[1]
            )
          }
        function E(e) {}
      },
      9807: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, {
          accessibilityDirectMap: () => i,
          accessibilityWebRoleToNativeRole: () => d,
          nativeAccessibilityState: () => c,
          nativeAccessibilityValue: () => u,
          webToNativeAccessibilityDirectMap: () => s,
        }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = {}
        {
          const e = {
            Hidden: !0,
            ActiveDescendant: !0,
            Atomic: !0,
            AutoComplete: !0,
            Busy: !0,
            Checked: !0,
            ColumnCount: 'colcount',
            ColumnIndex: 'colindex',
            ColumnSpan: 'colspan',
            Current: !0,
            Details: !0,
            ErrorMessage: !0,
            Expanded: !0,
            HasPopup: !0,
            Invalid: !0,
            Label: !0,
            Level: !0,
            Modal: !0,
            Multiline: !0,
            MultiSelectable: !0,
            Orientation: !0,
            Owns: !0,
            Placeholder: !0,
            PosInSet: !0,
            Pressed: !0,
            RoleDescription: !0,
            RowCount: !0,
            RowIndex: !0,
            RowSpan: !0,
            Selected: !0,
            SetSize: !0,
            Sort: !0,
            ValueMax: !0,
            ValueMin: !0,
            ValueNow: !0,
            ValueText: !0,
          }
          for (const t in e) {
            let n = e[t]
            ;(!0 === n && (n = t.toLowerCase()), (i[`accessibility${t}`] = `aria-${n}`))
          }
        }
        const s = null,
          u = null,
          c = null,
          d = null
      },
      9991: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, {
          FONT_DATA_ATTRIBUTE_NAME: () => u,
          MISSING_THEME_MESSAGE: () => f,
          THEME_CLASSNAME_PREFIX: () => s,
          THEME_NAME_SEPARATOR: () => i,
          stackDefaultStyles: () => c,
          webViewFlexCompatStyles: () => d,
        }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = '_',
          s = 't_',
          u = 'data-tamagui-font',
          c = {},
          d = {
            display: 'flex',
            alignItems: 'stretch',
            flexDirection: 'column',
            flexBasis: 'auto',
            boxSizing: 'border-box',
            position:
              '1' === { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_POSITION_STATIC
                ? 'static'
                : 'relative',
            minHeight: 0,
            minWidth: 0,
            flexShrink: 0,
          }
        Object.assign(c, d)
        const f = 'Missing theme.'
      },
      674: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { isDevTools: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = !1
      },
      8386: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { webToNativeDynamicExpansion: () => i, webToNativeExpansion: () => s }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = {},
          s = {}
      },
      5739: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { ComponentContext: () => u }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        const u = (0, n(310).createStyledContext)({
          disableSSR: void 0,
          inText: !1,
          language: null,
          animationDriver: null,
          setParentFocusState: null,
          groups: { emit: null, subscribe: null, state: {} },
        })
      },
      8715: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, {
          Spacer: () => W,
          Unspaced: () => V,
          componentSetStates: () => D,
          createComponent: () => L,
          spacedChildren: () => B,
        }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = n(6051),
          p = n(1277),
          m = n(6013),
          b = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          h = n(2544),
          g = n(9991),
          y = (n(674), n(5739)),
          v = n(2034),
          S = n(1713),
          w = n(8172),
          O = n(6638),
          k = (n(7522), n(9194)),
          x = n(9734),
          P = n(1597),
          _ = n(3211),
          C = n(6403),
          E = n(102),
          j = n(3750),
          T = n(5873),
          R = n(6535),
          N = n(9399),
          M = n(2778),
          A = n(2351)
        const D = new Set()
        if (typeof window < 'u') {
          const e = () => {
            ;(D.forEach((e) =>
              e((e) => (e.press || e.pressIn ? { ...e, press: !1, pressIn: !1 } : e))
            ),
              D.clear())
          }
          ;(addEventListener('mouseup', e),
            addEventListener('touchend', e),
            addEventListener('touchcancel', e))
        }
        let z, I
        const $ = { value: !1 }
        function L(e) {
          const { componentName: t } = e
          let n = null,
            r = e.defaultProps
          ;(0, h.onConfiguredOnce)((e) => {
            if (((n = e), t)) {
              const n = e.defaultProps?.[t]
              n && (r = { ...n, ...r })
            }
          })
          const { Component: o, isText: a, isZStack: l, isHOC: i } = e,
            s = b.default.forwardRef((t, s) => {
              const u = b.default.useContext(y.ComponentContext)
              let c, d, h
              const { context: g, isReactNative: _ } = e
              if (g && ((h = b.default.useContext(g)), h))
                for (const e in g.props) {
                  const n = (0, w.getShorthandValue)(t, e)
                  if (void 0 === n) {
                    const t = h?.[e]
                    void 0 !== t && ((c ||= {}), (c[e] = t))
                  }
                  const o = n ?? r?.[e]
                  void 0 !== o && ((d ||= {}), (d[e] = o))
                }
              const L = t.debug,
                V = c ? { ...r, ...c } : r
              let W = t
              V && (W = (0, k.mergeProps)(V, t))
              const H = W.componentName || e.componentName,
                U = u.animationDriver,
                G = U?.useAnimations,
                X = (0, E.useComponentState)(W, u, e, n),
                {
                  curStateRef: Y,
                  disabled: K,
                  groupName: Q,
                  hasAnimationProp: Z,
                  hasEnterStyle: J,
                  isAnimated: ee,
                  isExiting: te,
                  isHydrated: ne,
                  presence: re,
                  presenceState: oe,
                  setState: ae,
                  noClass: le,
                  state: ie,
                  stateRef: se,
                  supportsCSSVars: ue,
                  willBeAnimated: ce,
                  willBeAnimatedClient: de,
                  startedUnhydrated: fe,
                } = X
              let pe = X.setStateShallow
              const me = !!(p.isWeb && a && u.inText),
                be = !o || 'string' == typeof o,
                he = W.tag,
                ge = (p.isWeb && be && he) || o
              let ye = a ? z || ge || 'span' : I || ge || (me ? 'span' : 'div')
              U && ee && !U.needsWebStyles && (ye = U[a ? 'Text' : 'View'] || ye)
              const ve = W['data-disable-theme'] || i
              W.themeShallow && (Y.themeShallow = !0)
              const Se = { componentName: H, disable: ve, shallow: Y.themeShallow, debug: L }
              ;('themeInverse' in W && (Se.inverse = W.themeInverse),
                'theme' in W && (Se.name = W.theme),
                'boolean' == typeof Y.isListeningToTheme &&
                  (Se.needsUpdate = () => !!se.current.isListeningToTheme))
              const [we, Oe] = (0, T.useThemeWithState)(Se)
              ye = o || ye
              const ke = (0, j.useMedia)(u, L)
              ;(0, v.setDidGetVariableValue)(!1)
              const xe = {
                  mediaState: ke,
                  noClass: le,
                  resolveValues: (ee && !ue) || (i && 0 == ie.unmounted && Z) ? 'value' : 'auto',
                  isExiting: te,
                  isAnimated: ee,
                  willBeAnimated: ce,
                  styledContextProps: c,
                  noMergeStyle: ee && U?.needsWebStyles,
                },
                Pe = Oe?.name || '',
                _e = (0, O.useSplitStyles)(W, e, we, Pe, ie, xe, null, u, ye, fe, L)
              if (Z && U?.avoidReRenders) {
                const t = se.current.useStyleListener,
                  n = pe
                pe = (r) => {
                  const o = new Set(['hover', 'press', 'pressIn'])
                  if (Object.keys(r).every((e) => o.has(e)) && t) {
                    const n = { ...ie, ...r },
                      o = (0, O.getSplitStyles)(W, e, we, Pe, n, xe, null, u, ye, fe, L)
                    t(o.style)
                  } else n(r)
                }
              }
              ;(W.group &&
                'hide' === W.untilMeasured &&
                !Y.hasMeasured &&
                ((_e.style ||= {}), (_e.style.opacity = 0)),
                (Y.isListeningToTheme = _e.dynamicThemeAccess))
              const Ce = _e.hasMedia && !0 !== _e.hasMedia,
                Ee = (0, v.didGetVariableValue)() || Ce || (le && !0 === _e.hasMedia),
                je = Ce ? _e.hasMedia : null
              ;(0, j.setMediaShouldUpdate)(u, Ee, je)
              const { viewProps: Te, pseudos: Re, style: Ne, classNames: Me, space: Ae } = _e,
                De = W,
                {
                  asChild: ze,
                  children: Ie,
                  themeShallow: $e,
                  spaceDirection: Le,
                  onPress: Fe,
                  onLongPress: Ve,
                  onPressIn: We,
                  onPressOut: Be,
                  onHoverIn: He,
                  onHoverOut: Ue,
                  onMouseUp: Ge,
                  onMouseDown: qe,
                  onMouseEnter: Xe,
                  onMouseLeave: Ye,
                  onFocus: Ke,
                  onBlur: Qe,
                  separator: Ze,
                  forceStyle: Je,
                  onClick: et,
                  theme: tt,
                  ...nt
                } = Te
              let rt,
                ot,
                at = nt
              if (
                (!be && W.forceStyle && (at.forceStyle = W.forceStyle),
                i && tt && (at.theme = tt),
                he && ye.acceptTagProp && (at.tag = he),
                (ue ? de : ce) && G && !i)
              ) {
                const t = G({
                  props: De,
                  style: Ne || {},
                  styleState: _e,
                  useStyleEmitter: U?.avoidReRenders
                    ? (e) => {
                        se.current.useStyleListener = e
                      }
                    : void 0,
                  presence: re,
                  componentState: ie,
                  styleProps: xe,
                  theme: we,
                  pseudos: Re || null,
                  staticConfig: e,
                  stateRef: se,
                })
                t &&
                  ((rt = t.style),
                  (at.style = rt),
                  t.className &&
                    (at.className = `${'should-enter' === ie.unmounted ? 't_unmounted ' : ''}${at.className || ''} ${t.className}`),
                  t.ref && (ot = t.ref))
              }
              ;(Q &&
                (nt.onLayout = (0, m.composeEventHandlers)(nt.onLayout, (e) => {
                  const t = e.nativeEvent.layout
                  ;((se.current.group.layout = t),
                    se.current.group.emit(Q, { layout: t }),
                    !se.current.hasMeasured && 'hide' === W.untilMeasured && ae((e) => ({ ...e })),
                    (se.current.hasMeasured = !0))
                })),
                (at = R.hooks.usePropsTransform?.(ye, nt, se, Y.willHydrate) || nt),
                Y.composedRef ||
                  (Y.composedRef = (0, f.composeRefs)(
                    (e) => (se.current.host = e),
                    s,
                    x.setElementProps,
                    ot
                  )),
                (at.ref = Y.composedRef))
              const { pseudoGroups: lt, mediaGroups: it } = _e,
                st = () => {
                  pe({ press: !1, pressIn: !1 })
                }
              ;((0, p.useIsomorphicLayoutEffect)(() => {
                if (!0 === ie.unmounted && J) return void pe({ unmounted: 'should-enter' })
                let e
                if (ie.unmounted)
                  return (U?.supportsCSSVars ?? n?.animations?.supportsCSSVars) || p.isAndroid
                    ? ((e = setTimeout(() => {
                        pe({ unmounted: !1 })
                      })),
                      () => clearTimeout(e))
                    : void pe({ unmounted: !1 })
                const t =
                  K || (!lt && !it)
                    ? null
                    : (0, P.subscribeToContextGroup)({
                        componentContext: u,
                        setStateShallow: pe,
                        state: ie,
                        mediaGroups: it,
                        pseudoGroups: lt,
                      })
                return () => {
                  ;(t?.(), D.delete(ae))
                }
              }, [
                ie.unmounted,
                K,
                lt ? Object.keys([...lt]).join('') : 0,
                it ? Object.keys([...it]).join('') : 0,
              ]),
                (0, p.useIsomorphicLayoutEffect)(() => {
                  if (!Q) return
                  Y.group.emit(Q, { pseudo: ie, layout: Y.group?.layout })
                  const e = u?.groups
                  if (e) {
                    const t = { ...e[Q], ...ie }
                    e[Q] = t
                  }
                }, [Q, ie]))
              const ut = !K && le && Re?.pressStyle,
                ct = !K && le && Re?.focusStyle,
                dt = !!(
                  ut ||
                  ct ||
                  (!K && le && Re?.focusVisibleStyle) ||
                  Ke ||
                  Qe ||
                  u.setParentFocusState
                ),
                ft = !(!Q || !ie.hasDynGroupChildren),
                pt = !!(
                  ft ||
                  ut ||
                  Fe ||
                  Be ||
                  We ||
                  qe ||
                  Ge ||
                  Ve ||
                  et ||
                  Re?.focusVisibleStyle
                ),
                mt = !K && le && Re?.hoverStyle,
                bt = !(!ft && !mt),
                ht = p.isWeb && !!(ft || bt || Xe || Ye),
                gt = !K && !W.asChild && !!(dt || pt || ht || ut || mt || ct),
                yt = !(!ft && !ut),
                vt = gt
                  ? {
                      onPressOut: pt
                        ? (e) => {
                            ;(st(), Be?.(e), Ge?.(e))
                          }
                        : void 0,
                      ...((ht || pt) && {
                        onMouseEnter: (e) => {
                          const t = {}
                          ;(bt && (t.hover = !0),
                            yt && ie.pressIn && (t.press = !0),
                            pe(t),
                            He?.(e),
                            Xe?.(e))
                        },
                        onMouseLeave: (e) => {
                          const t = {}
                          ;(bt && (t.hover = !1),
                            yt && ie.pressIn && ((t.press = !1), (t.pressIn = !1)),
                            pe(t),
                            Ue?.(e),
                            Ye?.(e))
                        },
                      }),
                      onPressIn: pt
                        ? (e) => {
                            ;(yt && pe({ press: !0, pressIn: !0 }),
                              We?.(e),
                              qe?.(e),
                              p.isWeb && D.add(ae))
                          }
                        : void 0,
                      onPress: pt
                        ? (e) => {
                            ;(st(), p.isWeb && et?.(e), Fe?.(e), Ve?.(e))
                          }
                        : void 0,
                      ...(dt && {
                        onFocus: (e) => {
                          ;(u.setParentFocusState && u.setParentFocusState({ focusWithin: !0 }),
                            Re?.focusVisibleStyle
                              ? setTimeout(() => {
                                  pe({ focus: !0, focusVisible: !!$.value })
                                }, 0)
                              : pe({ focus: !0, focusVisible: !1 }),
                            Ke?.(e))
                        },
                        onBlur: (e) => {
                          ;(u.setParentFocusState && u.setParentFocusState({ focusWithin: !1 }),
                            pe({ focus: !1, focusVisible: !1 }),
                            Qe?.(e))
                        },
                      }),
                    }
                  : null
              ;(vt && !_ && Object.assign(at, F(vt)), R.hooks.useEvents?.(at, vt, _e, pe, e))
              const St = W.spaceDirection || 'both'
              let wt,
                Ot =
                  !Ie || ze
                    ? Ie
                    : B({
                        separator: Ze,
                        children: Ie,
                        space: Ae,
                        direction: St,
                        isZStack: l,
                        debug: L,
                      })
              if (ze) {
                ye = N.Slot
                {
                  const e = F(
                    {
                      onPress: Fe,
                      onLongPress: Ve,
                      onPressIn: We,
                      onPressOut: Be,
                      onMouseUp: Ge,
                      onMouseDown: qe,
                      onMouseEnter: Xe,
                      onMouseLeave: Ye,
                    },
                    'web' === ze || 'except-style-web' === ze
                  )
                  Object.assign(at, e)
                }
              }
              ;(R.hooks.useChildren && (wt = R.hooks.useChildren(ye, Ot, at)),
                (Ot = wt || b.default.createElement(ye, at, Ot)))
              const kt = n?.animations?.ResetPresence
              kt &&
                ce &&
                (J || oe) &&
                Ot &&
                'string' != typeof Ot &&
                (Ot = (0, A.jsx)(kt, { children: Ot }))
              const xt = Y.group,
                Pt = b.default.useMemo(() => {
                  if (xt && Q)
                    return (
                      xt.listeners.clear(),
                      {
                        ...u.groups,
                        state: {
                          ...u.groups.state,
                          [Q]: {
                            pseudo: S.defaultComponentStateMounted,
                            layout: { width: q(_e.style?.width), height: q(_e.style?.height) },
                          },
                        },
                        emit: xt.emit,
                        subscribe: xt.subscribe,
                      }
                    )
                }, [Q])
              if (
                (('group' in W || t.focusWithinStyle) &&
                  (Ot = (0, A.jsx)(y.ComponentContext.Provider, {
                    ...u,
                    groups: Pt,
                    setParentFocusState: pe,
                    children: Ot,
                  })),
                (Ot = ve ? Ot : (0, M.getThemedChildren)(Oe, Ot, Se, !1, se)),
                _ &&
                  !ze &&
                  (Ot = (0, A.jsx)('span', {
                    className: '_dsp_contents',
                    ...(ne && vt && F(vt)),
                    children: Ot,
                  })),
                e.context)
              ) {
                const t = e.context.props
                for (const e in t)
                  ((at.style && e in at.style) || e in at) &&
                    ((d ||= {}), (d[e] = at.style?.[e] ?? at[e]))
              }
              if (d) {
                const t = e.context.Provider
                Ot = (0, A.jsx)(t, { ...h, ...d, children: Ot })
              }
              if (fe) {
                const e = (0, b.useMemo)(
                  () => (0, C.getStyleTags)(Object.values(_e.rulesToInsert)),
                  []
                )
                Ot = (0, A.jsxs)(A.Fragment, { children: [Ot, e] })
              }
              return Ot
            })
          e.componentName && (s.displayName = e.componentName)
          let u = s
          function c(t) {
            return { ...e, ...t, neverFlatten: !0, isHOC: !0, isStyledHOC: !1 }
          }
          function d(e, t) {
            let n =
              (p.IS_REACT_19 && 'function' == typeof e && 1 === e.length) || 2 === e.render?.length
                ? e
                : b.default.forwardRef(e)
            const r = c(t?.staticConfig)
            return (
              (n = t?.disableTheme ? n : (0, _.themeable)(n, r, !0)),
              { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_MEMOIZE_STYLEABLE &&
                (n = b.default.memo(n)),
              (n.staticConfig = r),
              (n.styleable = d),
              n
            )
          }
          return (
            ({ __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_FORCE_MEMO || e.memo) &&
              (u = b.default.memo(u)),
            (u.staticConfig = e),
            (u.extractable = function (e, t) {
              return ((e.staticConfig = c(t)), (e.styleable = d), e)
            }),
            (u.styleable = d),
            u
          )
        }
        function F(e, t = !0) {
          return {
            onMouseEnter: e.onMouseEnter,
            onMouseLeave: e.onMouseLeave,
            [t ? 'onClick' : 'onPress']: e.onPress,
            onMouseDown: e.onPressIn,
            onMouseUp: e.onPressOut,
            onTouchStart: e.onPressIn,
            onTouchEnd: e.onPressOut,
            onFocus: e.onFocus,
            onBlur: e.onBlur,
          }
        }
        function V(e) {
          return e.children
        }
        ;(p.isWeb &&
          globalThis.document &&
          (document.addEventListener('keydown', () => {
            $.value = !0
          }),
          document.addEventListener('mousedown', () => {
            $.value = !1
          }),
          document.addEventListener('mousemove', () => {
            $.value = !1
          })),
          (V.isUnspaced = !0))
        const W = L({
          acceptsClassName: !0,
          memo: !0,
          componentName: 'Spacer',
          validStyles: m.validStyles,
          defaultProps: { ...g.stackDefaultStyles, tag: 'span', size: !0, pointerEvents: 'none' },
          variants: {
            size: {
              '...': (e, { tokens: t }) => {
                e = !1 === e ? 0 : !0 === e ? '$true' : e
                const n = t.space[e] ?? e
                return { width: n, height: n, minWidth: n, minHeight: n }
              },
            },
            flex: { true: { flexGrow: 1 } },
            direction: {
              horizontal: { height: 0, minHeight: 0 },
              vertical: { width: 0, minWidth: 0 },
              both: {},
            },
          },
        })
        function B(e) {
          const {
              isZStack: t,
              children: n,
              space: r,
              direction: o,
              spaceFlex: a,
              separator: l,
              ensureKeys: i,
            } = e,
            s = !(!r && !a),
            u = null != l,
            c = Array.isArray(n)
          if (!i && !(s || u || t)) return n
          const d = c ? n : b.default.Children.toArray(n)
          if (d.length <= 1 && !t && !d[0]?.type?.shouldForwardSpace) return n
          const f = []
          for (let [e, n] of d.entries()) {
            const i = null == n || (Array.isArray(n) && 0 === n.length)
            if (
              (!i &&
                b.default.isValidElement(n) &&
                n.type?.shouldForwardSpace &&
                (n = b.default.cloneElement(n, {
                  space: r,
                  spaceFlex: a,
                  separator: l,
                  key: n.key,
                })),
              i || !n || (n.key && !t)
                ? f.push(n)
                : f.push(
                    (0, A.jsx)(
                      b.default.Fragment,
                      { children: t ? (0, A.jsx)(G, { children: n }) : n },
                      `${e}0t`
                    )
                  ),
              (U(n) && 0 === e) || t)
            )
              continue
            const u = d[e + 1]
            u &&
              !i &&
              !U(u) &&
              (l
                ? (s && f.push(H({ key: `_${e}_00t`, direction: o, space: r, spaceFlex: a })),
                  f.push((0, A.jsx)(b.default.Fragment, { children: l }, `${e}03t`)),
                  s && f.push(H({ key: `_${e}01t`, direction: o, space: r, spaceFlex: a })))
                : f.push(H({ key: `_${e}02t`, direction: o, space: r, spaceFlex: a })))
          }
          return f
        }
        function H({ key: e, direction: t, space: n, spaceFlex: r }) {
          return (0, A.jsx)(
            W,
            {
              size: n,
              direction: t,
              ...(typeof r < 'u' && { flex: !0 === r ? 1 : !1 === r ? 0 : r }),
            },
            e
          )
        }
        function U(e) {
          const t = e?.type
          return t?.isVisuallyHidden || t?.isUnspaced
        }
        const G = L({
            defaultProps: {
              ...g.stackDefaultStyles,
              flexDirection: 'column',
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              pointerEvents: 'box-none',
            },
          }),
          q = (e) => ('number' == typeof e ? e : 'string' == typeof e ? +e.replace('px', '') : 0)
      },
      4985: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { createFont: () => u }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
          s = (e, t, n) => {
            if ('string' == typeof e) return e
            const r = Object.keys(e)
            let o = e[r[0]]
            return Object.fromEntries(
              [...new Set([...t, ...r])].map((t) => {
                const r = e[t] ?? n ?? o
                return ((o = r), (n = r), [t, r])
              })
            )
          },
          u = (e) => {
            const t = Object.keys(e.size || {}),
              n = Object.fromEntries(
                Object.entries(e).map(([n, r]) => [
                  n,
                  s(r, 'face' === n ? i : t, 'face' === n ? { normal: e.family } : void 0),
                ])
              )
            return Object.freeze(n)
          }
      },
      1806: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i(e) {
          return Object.freeze(e)
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { createShorthands: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
      },
      3774: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { createTamagui: () => S }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(2544),
          d = n(5445),
          f = n(7837),
          p = n(1364),
          m = n(163),
          b = n(4392),
          h = n(6706),
          g = n(3750),
          y = n(1018)
        n(8746)
        const v = new WeakMap()
        function S(e) {
          if (v.has(e)) return e
          const t = {},
            n = (0, d.createVariables)(e.tokens || {})
          if (e.tokens) {
            const e = {}
            for (const r in n) {
              ;((t[r] = {}), (e[r] = {}))
              const o = n[r]
              for (const n in o) {
                const a = o[n],
                  l = `$${n}`
                ;((t[r][l] = a), (e[r][l] = a), (e[r][n] = a))
              }
            }
            ;(0, c.setTokens)(e)
          }
          let r
          if (e.themes) {
            const n = 0 === Object.keys(e.themes).length
            ;(n && (r = (0, p.scanAllSheets)(n, t)),
              (u.IS_REACT_19 &&
                { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }
                  .TAMAGUI_SKIP_THEME_OPTIMIZATION) ||
                (n && (0, p.listenForSheetChanges)()))
          }
          let o,
            a = null
          if (e.fonts) {
            const t = Object.fromEntries(
              Object.entries(e.fonts).map(([e, t]) => [e, (0, d.createVariables)(t, 'f', !0)])
            )
            o = (() => {
              const e = {}
              for (const n in t) {
                const r = t[n],
                  o = (0, y.parseFont)(r)
                ;((e[`$${n}`] = o), !a && o.size && (a = new Set(Object.keys(o.size))))
              }
              return e
            })()
          }
          const l = {},
            i = (() => {
              const t = [],
                a = [],
                i = {}
              for (const e in n)
                for (const t in n[e]) {
                  const r = n[e][t]
                  if (((l[`$${e}.${t}`] = r), u.isWeb)) {
                    ;(0, b.registerCSSVariable)(r)
                    const t = !0 === r.needsPx,
                      n = ((s = e), new Set(['size', 'space', 'radius']).has(s)),
                      o = !(t || n)
                    a.push((0, b.variableToCSS)(r, o))
                  }
                }
              var s
              {
                let n = function (e, t = '') {
                  return `:root${t} {${r}${[...e].join(`;${r}`)}${r}}`
                }
                for (const e in o) {
                  const t = o[e],
                    [n, r] = e.includes('_') ? e.split('_') : [e],
                    a = (0, y.registerFontVariables)(t)
                  i[e] = { name: n.slice(1), declarations: a, language: r }
                }
                const r = e.cssStyleSeparator || ''
                if ((t.push(n(a)), i))
                  for (const e in i) {
                    const { name: r, declarations: o, language: a = 'default' } = i[e],
                      l = `.font_${r}`,
                      s = `:root .t_lang-${r}-${a} ${l}`,
                      u = n(o, 'default' === a ? ` ${l}, ${s}` : s)
                    t.push(u)
                  }
              }
              const c = e.themes,
                d =
                  r ??
                  (function (e) {
                    const t = [],
                      n = new Map()
                    for (const r in e) {
                      const o = r.startsWith('dark')
                          ? 'dark'
                          : r.startsWith('light')
                            ? 'light'
                            : '',
                        a = e[r],
                        l = o + JSON.stringify(a)
                      if (n.has(l)) {
                        n.get(l).names.push(r)
                        continue
                      }
                      const i = { ...a }
                      for (const e in i) (0, h.ensureThemeVariable)(i, e)
                      const s = { names: [r], theme: i }
                      ;(t.push(s), n.set(l, s))
                    }
                    return t
                  })(c)
              return {
                themes: (0, m.proxyThemesToParents)(d),
                cssRuleSets: t,
                getThemeRulesSets() {
                  let t = []
                  if (u.isWeb)
                    for (const { names: n, theme: r } of d) {
                      const o = (0, f.getThemeCSSRules)({
                        config: e,
                        themeName: n[0],
                        names: n,
                        theme: r,
                      })
                      t = [...t, ...o]
                    }
                  return t
                },
              }
            })(),
            s = e.shorthands || {}
          let S = -1
          const w = (e = {}) => {
              {
                const { separator: t = '\n', sinceLastCall: n, exclude: r } = e
                if (n && S >= 0) {
                  const e = (0, p.getAllRules)()
                  return ((S = e.length), e.slice(S).join(t))
                }
                S = 0
                const o = (0, p.getAllRules)().join(t)
                return 'design-system' === r
                  ? o
                  : `._ovs-contain {overscroll-behavior:contain;}\n  .is_Text .is_Text {display:inline-flex;}\n  ._dsp_contents {display:contents;}\n  ${i.cssRuleSets.join(t)}\n  ${r ? '' : i.getThemeRulesSets().join(t)}\n  ${o}`
              }
            },
            O = e.settings?.defaultFont ?? e.defaultFont,
            k = (() => {
              let e = O
              return ('$' === e?.[0] && (e = e.slice(1)), e)
            })(),
            x = k ? `$${k}` : '',
            P = { ...e.unset }
          !P.fontFamily && k && (P.fontFamily = x)
          const _ = {
            fonts: {},
            onlyAllowShorthands: !1,
            fontLanguages: [],
            animations: {},
            media: {},
            ...e,
            unset: P,
            settings: {
              disableSSR: e.disableSSR,
              defaultFont: e.defaultFont,
              disableRootThemeClass: e.disableRootThemeClass,
              onlyAllowShorthands: e.onlyAllowShorthands,
              mediaQueryDefaultActive: e.mediaQueryDefaultActive,
              themeClassNameOnRoot: e.themeClassNameOnRoot,
              cssStyleSeparator: e.cssStyleSeparator,
              webContainerType: 'inline-size',
              ...e.settings,
            },
            tokens: n,
            shorthands: s,
            inverseShorthands: s
              ? Object.fromEntries(Object.entries(s).map(([e, t]) => [t, e]))
              : {},
            themes: i.themes,
            fontsParsed: o || {},
            themeConfig: i,
            tokensParsed: t,
            parsed: !0,
            getNewCSS: (e) => w({ ...e, sinceLastCall: !0 }),
            getCSS: w,
            defaultFont: k,
            fontSizeTokens: a || new Set(),
            specificTokens: l,
            defaultFontToken: x,
          }
          return (
            (0, c.setConfig)(_),
            (0, g.configureMedia)(_),
            v.set(_, !0),
            c.configListeners.size &&
              (c.configListeners.forEach((e) => e(_)), c.configListeners.clear()),
            _
          )
        }
      },
      4169: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { createTheme: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = (e) => e
      },
      1036: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { createTokens: () => c }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(5445)
        function c(e) {
          return (0, u.createVariables)(
            e,
            { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_TOKEN_PREFIX ?? 't'
          )
        }
      },
      2034: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          createCSSVariable: () => k,
          createVariable: () => p,
          didGetVariableValue: () => v,
          getVariable: () => h,
          getVariableName: () => w,
          getVariableValue: () => S,
          getVariableVariable: () => O,
          isVariable: () => b,
          px: () => x,
          setDidGetVariableValue: () => y,
          variableToString: () => m,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(6013),
          d = n(2544)
        function f(e) {
          return `var(--${{ __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_CSS_VARIABLE_PREFIX || ''}${e})`
        }
        const p = (e, t = !1) => {
          if (!t && b(e)) return e
          const { key: n, name: r, val: o } = e
          return {
            isVar: !0,
            key: n,
            name: t ? r : (0, c.simpleHash)(r, 40),
            val: o,
            variable: u.isWeb ? (t ? f(r) : k(r)) : '',
          }
        }
        function m(e, t = !1) {
          return b(e) ? (!t && u.isWeb && e.variable ? e.variable : `${e.val}`) : `${e || ''}`
        }
        function b(e) {
          return e && 'object' == typeof e && 'isVar' in e
        }
        function h(e, t = 'size') {
          if (e?.dynamic) return e
          if ((y(!0), b(e))) return m(e)
          const n = (0, d.getConfig)().tokensParsed
          return m(n[t]?.[e] ?? e)
        }
        let g = !1
        const y = (e) => (g = e),
          v = () => g
        function S(e, t) {
          if (b(e)) return (y(!0), e.val)
          if (t) {
            const n = (0, d.getConfig)().tokensParsed[t]?.[e]
            if (n) return (y(!0), n.val)
          }
          return e
        }
        function w(e) {
          return b(e) ? e.name : e
        }
        function O(e) {
          return b(e) ? e.variable : e
        }
        const k = (e, t = !0) => {
          const n = (0, c.simpleHash)(e, 60)
          return t ? f(n) : n
        }
        function x(e) {
          return { val: e, needsPx: !0 }
        }
      },
      5445: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { createVariables: () => p }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(6013),
          d = n(2034)
        const f = new WeakMap(),
          p = (e, t = '', n = !1) => {
            if (f.has(e)) return e
            const r = {}
            for (let n in e) {
              const o = e[n],
                a = '$' === n[0],
                l = a ? n : `$${n}`,
                i = a ? l.slice(1) : n
              if ((0, d.isVariable)(o)) {
                r[i] = o
                continue
              }
              const s = (0, c.simpleHash)(i, 1e3),
                f = t && 't-color' !== t ? `${t}-${s}` : `c-${s}`
              if (o && 'object' == typeof o && 'needsPx' in o && 'val' in o) {
                const e = (0, d.createVariable)({ val: o.val, name: f, key: l })
                ;(u.isWeb && (e.needsPx = o.needsPx), (r[i] = e))
                continue
              }
              if (o && 'object' == typeof o) {
                r[i] = p(e[i], f, !1)
                continue
              }
              const m = (0, d.isVariable)(o)
                ? o
                : (0, d.createVariable)({ val: o, name: f, key: l })
              r[i] = m
            }
            return (f.set(r, !0), r)
          }
      },
      1713: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, {
          defaultComponentState: () => i,
          defaultComponentStateMounted: () => s,
          defaultComponentStateShouldEnter: () => u,
        }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = {
            hover: !1,
            press: !1,
            pressIn: !1,
            focus: !1,
            focusVisible: !1,
            focusWithin: !1,
            unmounted: !0,
            disabled: !1,
          },
          s = { ...i, unmounted: !1 },
          u = { ...i, unmounted: 'should-enter' }
      },
      5427: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { MEDIA_SEP: () => f, createMediaStyle: () => g }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(2544),
          c = n(3750),
          d = n(9244)
        const f = '_'
        let p = null,
          m = null
        const b = { press: 'active', focusVisible: 'focus-visible', focusWithin: 'focus-within' },
          h = new Array(5).fill(0).map((e, t) => new Array(t).fill(':root').join('')),
          g = (e, t, n, r, o, a) => {
            const [l, , i, s, g] = e
            let y = l
            const v = (0, u.getSetting)('mediaPropOrder'),
              S = 'theme' === r,
              w = 'platform' === r,
              O = 'group' === r,
              k = S || w || O,
              x = o ? '0' : '',
              P = i.slice(0, i.indexOf('-') + 1),
              _ = `${P}${f}${t.replace('-', '')}${x}${f}`
            let C,
              E,
              j = '',
              T = i.replace(P, _),
              R = g.map((e) => e.replace(i, T)).join(';'),
              N = !1
            if (k) {
              let e = (a || 0) + (O || w ? 1 : 0)
              if (S || O) {
                const n = (0, d.getGroupPropParts)(S ? 'theme-' + t : t),
                  { name: r, media: o, pseudo: a } = n
                ;((C = o),
                  O && (E = r),
                  ('press' === a || 'active' === s) && (e += 2),
                  'hover' === a && (N = !0))
                const [l, i] = (function (e, t, n, r, o = !1, a = '') {
                  const l = t.lastIndexOf(':root') + 5,
                    i = t.lastIndexOf('{'),
                    s = t.slice(l, i),
                    c = (0, u.getSetting)('themeClassNameOnRoot') && o ? '' : ' ',
                    d = r.pseudo ? b[r.pseudo] || r.pseudo : void 0
                  return [
                    s,
                    `:root${a}${c}.t_${n ? 'group_' : ''}${e}${d ? `:${d}` : ''} ${s.replaceAll(':root', '')}`,
                  ]
                })(r, R, O, n, S, h[e])
                j = R.replace(l, i)
              } else j = `${h[e]}${R}`
            }
            if (!k || C) {
              if (!m) {
                const e = Object.keys(n)
                ;((m = Object.fromEntries(e.map((e) => [e, (0, c.mediaObjectToString)(n[e])]))),
                  v ||
                    (p = Object.fromEntries(
                      e.map((e, t) => [e, new Array(t + 1).fill(':root').join('')])
                    )))
              }
              const e = C || t,
                r = `${o ? 'not all and ' : ''}${m[e]}`,
                l = C ? '' : v && a ? h[a] : p[e],
                i = C ? `@container ${E}` : '@media'
              ;(C && (R = j),
                (j = R.includes(i)
                  ? R.replace('{', ` and ${r} {`).replace('and screen and', 'and')
                  : `${i} ${r}{${l}${R}}`),
                C &&
                  (j = `@supports (contain: ${(0, u.getSetting)('webContainerType') || 'inline-size'}) {${j}}`))
            }
            return (N && (j = `@media (hover:hover){${j}}`), [y, void 0, T, void 0, [j]])
          }
      },
      310: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { createStyledContext: () => h }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          p = n(900),
          m = n(2351)
        const b = f.default[(Math.random(), 'createContext')]
        function h(e) {
          const t = b(e),
            n = t.Provider,
            r = t,
            o = new Map()
          function a(t) {
            let n = o.get(t)
            return (n || ((n = b(e)), o.set(t, n)), n)
          }
          return (
            (r.Provider = ({ children: t, scope: r, ...o }) => {
              const l = f.default.useMemo(() => ({ ...e, ...o }), [(0, p.objectIdentityKey)(o)])
              let i = n
              return (r && (i = a(r).Provider), (0, m.jsx)(i, { value: l, children: t }))
            }),
            (r.props = e),
            (r.context = t),
            (r.useStyledContext = (e) => {
              const n = e ? a(e) : t
              return f.default.useContext(n)
            }),
            r
          )
        }
      },
      3282: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { defaultOffset: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = { height: 0, width: 0 }
      },
      2723: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { expandStyle: () => p }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(2544),
          d = n(8386)
        const f = [
          ['flexGrow', 0],
          ['flexShrink', 1],
          ['flexBasis', 'auto'],
        ]
        function p(e, t) {
          if ('flex' === e)
            return -1 === t
              ? f
              : [
                  ['flexGrow', t],
                  ['flexShrink', 1],
                  ['flexBasis', 'react-native' === (0, c.getSetting)('styleCompat') ? 0 : 'auto'],
                ]
          switch (e) {
            case 'textAlignVertical':
              return [['verticalAlign', 'center' === t ? 'middle' : t]]
            case 'writingDirection':
              return [['direction', t]]
            case 'backdropFilter':
              return [
                ['backdropFilter', t],
                ['WebkitBackdropFilter', t],
              ]
          }
          return e in y
            ? y[e].map((e) => [e, t])
            : e in d.webToNativeExpansion
              ? d.webToNativeExpansion[e].map((e) => [e, t])
              : e in d.webToNativeDynamicExpansion
                ? d.webToNativeDynamicExpansion[e](t)
                : void 0
        }
        const m = ['Top', 'Right', 'Bottom', 'Left'],
          b = ['Right', 'Left'],
          h = ['Top', 'Bottom'],
          g = ['X', 'Y'],
          y = {
            borderColor: ['TopColor', 'RightColor', 'BottomColor', 'LeftColor'],
            borderRadius: [
              'TopLeftRadius',
              'TopRightRadius',
              'BottomRightRadius',
              'BottomLeftRadius',
            ],
            borderWidth: ['TopWidth', 'RightWidth', 'BottomWidth', 'LeftWidth'],
            margin: m,
            marginHorizontal: b,
            marginVertical: h,
            overscrollBehavior: g,
            padding: m,
            paddingHorizontal: b,
            paddingVertical: h,
            ...(u.isWeb && {
              borderStyle: ['TopStyle', 'RightStyle', 'BottomStyle', 'LeftStyle'],
              overflow: g,
            }),
          }
        for (const e in y) {
          const t = e.slice(0, /[A-Z]/.exec(e)?.index ?? e.length)
          y[e] = y[e].map((e) => `${t}${e}`)
        }
      },
      7642: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { fixStyles: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(3149)
        function d(e) {
          ;(null != e.shadowRadius || e.shadowColor || null != e.shadowOpacity || e.shadowOffset) &&
            Object.assign(e, (0, c.normalizeShadow)(e))
          for (const t in p) t in e && (e[p[t]] ||= 'solid')
        }
        const f = u.isWeb ? null : 'borderStyle',
          p = {
            borderWidth: 'borderStyle',
            borderBottomWidth: f || 'borderBottomStyle',
            borderTopWidth: f || 'borderTopStyle',
            borderLeftWidth: f || 'borderLeftStyle',
            borderRightWidth: f || 'borderRightStyle',
          }
      },
      9492: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { getCSSStylesAtomic: () => g, getStyleAtomic: () => y, styleToCSS: () => w }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(6013),
          c = n(2544),
          d = n(3282),
          f = n(3898),
          p = n(5687),
          m = n(4572),
          b = n(3691),
          h = n(3750)
        function g(e) {
          w(e)
          const t = []
          for (const n in e) {
            if ('$$css' === n) continue
            const r = e[n]
            if (n in m.pseudoDescriptors) r && t.push(...y(r, m.pseudoDescriptors[n]))
            else if ((0, h.isMediaKey)(n))
              for (const e in r) {
                const o = S(r, e)
                o && ((o[0] = n), t.push(o))
              }
            else {
              const r = S(e, n)
              r && t.push(r)
            }
          }
          return t
        }
        const y = (e, t) => {
          w(e)
          const n = []
          for (const r in e) {
            const o = S(e, r, t)
            o && n.push(o)
          }
          return n
        }
        let v = null
        const S = (e, t, n) => {
          let r = e[t]
          if (null == r) return
          'transform' === t && Array.isArray(e.transform) && (r = (0, b.transformsToString)(r))
          const o = (0, p.normalizeValueWithProperty)(r, t),
            a = (0, u.simpleHash)('string' == typeof o ? o : `${o}`),
            l = n ? `0${n.name}-` : ''
          v ||= (0, c.getConfigMaybe)()
          const i = `_${v?.inverseShorthands[t] || t}-${l}${a}`,
            s = (function (e, t, n, r) {
              const o = r ? ('disabled' === r.name ? '[aria-disabled]' : `:${r.name}`) : '',
                a = r?.selector
              let l = r ? (a ? `${a} .${e}` : `${_[r.name]} .${e}${o}`) : `:root .${e}`
              a === m.pseudoDescriptors.enterStyle.selector && (l = `${l}, .${e}${a}`)
              const i = !!r
              let s = []
              switch (t) {
                case 'placeholderTextColor': {
                  const e = O(
                    [
                      ['color', n],
                      ['opacity', 1],
                    ],
                    i
                  )
                  s.push(`${l}::placeholder${e}`)
                  break
                }
                case 'backgroundClip':
                case 'userSelect': {
                  const e = `Webkit${t[0].toUpperCase()}${t.slice(1)}`,
                    r = O(
                      [
                        [t, n],
                        [e, n],
                      ],
                      i
                    )
                  s.push(`${l}${r}`)
                  break
                }
                case 'pointerEvents': {
                  let e = n
                  'auto' === n || 'box-only' === n
                    ? ((e = 'auto'), 'box-only' === n && s.push(`${l}>*${E}`))
                    : ('none' === n || 'box-none' === n) &&
                      ((e = 'none'), 'box-none' === n && s.push(`${l}>*${C}`))
                  const t = O([['pointerEvents', e]], !0)
                  s.push(`${l}${t}`)
                  break
                }
                default: {
                  const e = O([[t, n]], i)
                  s.push(`${l}${e}`)
                  break
                }
              }
              return ('hover' === r?.name && (s = s.map((e) => `@media (hover) {${e}}`)), s)
            })(i, t, o, n)
          return [t, o, i, n?.name, s]
        }
        function w(e) {
          const { shadowOffset: t, shadowRadius: n, shadowColor: r, shadowOpacity: o } = e
          if (n || r) {
            const a = t || d.defaultOffset,
              l = `${(0, p.normalizeValueWithProperty)(a.width)} ${(0, p.normalizeValueWithProperty)(a.height)} ${(0, p.normalizeValueWithProperty)(n)} ${(0, f.normalizeColor)(r, o)}`
            ;((e.boxShadow = e.boxShadow ? `${e.boxShadow}, ${l}` : l),
              delete e.shadowOffset,
              delete e.shadowRadius,
              delete e.shadowColor,
              delete e.shadowOpacity)
          }
          const { textShadowColor: a, textShadowOffset: l, textShadowRadius: i } = e
          if (a || l || i) {
            const { height: t, width: n } = l || d.defaultOffset,
              r = i || 0,
              o = (0, p.normalizeValueWithProperty)(a, 'textShadowColor')
            if (o && (0 !== t || 0 !== n || 0 !== r)) {
              const a = (0, p.normalizeValueWithProperty)(r),
                l = (0, p.normalizeValueWithProperty)(n),
                i = (0, p.normalizeValueWithProperty)(t)
              e.textShadow = `${l} ${i} ${a} ${o}`
            }
            ;(delete e.textShadowColor, delete e.textShadowOffset, delete e.textShadowRadius)
          }
        }
        function O(e, t = !1) {
          let n = ''
          for (const [r, o] of e) n += `${P(r)}:${o}${t ? ' !important' : ''};`
          return `{${n}}`
        }
        const k = {},
          x = (e) => `-${e.toLowerCase()}`,
          P = (e) => {
            if (e in k) return k[e]
            const t = e.replace(/[A-Z]/g, x)
            return ((k[e] = t), t)
          },
          _ = (() => {
            const e = {}
            for (const t in m.pseudoDescriptors) {
              const n = m.pseudoDescriptors[t]
              e[n.name] = `${[...Array(n.priority)].map(() => ':root').join('')} `
            }
            return e
          })(),
          C = O([['pointerEvents', 'auto']], !0),
          E = O([['pointerEvents', 'none']], !0)
      },
      8784: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i(e) {
          return 'dark' === e ? 'light' : 'dark'
        }
        function s({ scheme: e, val: t, oppositeVal: n }) {
          return { dynamic: { [e]: t, [i(e)]: n } }
        }
        function u(e, t) {
          return e?.dynamic ? e.dynamic[t] : e
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, {
          extractValueFromDynamic: () => u,
          getDynamicVal: () => s,
          getOppositeScheme: () => i,
        }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
      },
      3383: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { getExpandedShorthand: () => d, getExpandedShorthands: () => c }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(2544)
        function c(e) {
          const t = (0, u.getConfig)().shorthands
          if (!t) return e
          const n = {}
          for (const r in e) n[t[r] || r] = e[r]
          return n
        }
        function d(e, t) {
          const n = (0, u.getConfig)().inverseShorthands
          return t[e] ?? t[n[e]]
        }
      },
      9244: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { getGroupPropParts: () => c }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(3750)
        function c(e) {
          const t = (0, u.getMedia)(),
            [n, r, o, a] = e.split('-')
          let l
          const i = o in t ? o : void 0
          return ((l = i ? a : o), { name: r, pseudo: l, media: i })
        }
      },
      8172: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { getShorthandValue: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(2544)
        let c = null
        const d = (e, t) => (
          (c ||= (0, u.getConfig)().inverseShorthands),
          e[t] ?? (c ? e[c[t]] : void 0)
        )
      },
      6638: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, {
          PROP_SPLIT: () => A,
          getSplitStyles: () => z,
          getSubStyle: () => L,
          useSplitStyles: () => V,
        }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = n(1277),
          p = n(6013),
          m = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          b = n(8784),
          h = n(2544),
          g = n(9807),
          y = n(9991),
          v = (n(674), n(3750)),
          S = n(5427),
          w = n(7642),
          O = n(9492),
          k = n(9244),
          x = n(1364),
          P = n(3815),
          _ = n(8445),
          C = (n(7522), n(5687)),
          E = n(3096),
          j = n(4572),
          T = n(9141),
          R = n(5539),
          N = n(3691)
        let M
        const A = '-'
        function D(e, t, n) {
          return e in t || (n && e in n)
        }
        const z = (e, t, n, r, o, a, l, i, s, u, c) => {
          M = M || (0, h.getConfig)()
          const d = i?.animationDriver || M.animations
          f.isWeb && a.isAnimated && d.isReactNative && !a.noNormalize && (a.noNormalize = 'values')
          const { shorthands: m } = M,
            {
              isHOC: x,
              isText: C,
              isInput: R,
              variants: z,
              isReactNative: F,
              inlineProps: V,
              inlineWhenUnflattened: B,
              parentStaticConfig: H,
              acceptsClassName: U,
            } = t,
            q = {},
            X = a.mediaState || v.mediaState,
            ee = {},
            te = U && f.isWeb && !a.noClass && !a.isAnimated,
            ne = {},
            re = {}
          let oe,
            ae,
            le,
            ie = null,
            se = e.space,
            ue = !1,
            ce = (e.className, 0)
          const de = t.validStyles || (t.isText || t.isInput ? p.stylePropsText : p.validStyles),
            fe = {
              classNames: re,
              conf: M,
              props: e,
              styleProps: a,
              componentState: o,
              staticConfig: t,
              style: null,
              theme: n,
              usedKeys: ee,
              viewProps: q,
              context: i,
              debug: c,
            }
          if ('is_static' === { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.IS_STATIC) {
            const { fallbackProps: t } = a
            t &&
              (fe.props = new Proxy(e, {
                get: (n, r, o) => (Reflect.has(e, r) ? Reflect.get(e, r) : Reflect.get(t, r)),
              }))
          }
          const { asChild: pe } = e,
            { accept: me } = t,
            { noSkip: be, disableExpandShorthands: he, noExpand: ge } = a,
            { webContainerType: ye } = M.settings,
            ve = H?.variants
          for (const n in e) {
            let l = n,
              c = e[l]
            if ('children' === l) {
              q[l] = c
              continue
            }
            if (me) {
              const e = me[l]
              if (('style' === e || 'textStyle' === e) && c && 'object' == typeof c) {
                q[l] = L(fe, l, c, a.noClass)
                continue
              }
            }
            if (
              (he || (l in m && (l = m[l])),
              'className' === l || l in ee || (pe && y.webViewFlexCompatStyles[l] === c))
            )
              continue
            if (l in T.skipProps && !be && !x) {
              if ('group' === l) {
                const e = `t_group_${c}`
                W(
                  ne,
                  [
                    'continer',
                    void 0,
                    e,
                    void 0,
                    [`.${e} { container-name: ${c}; container-type: ${ye || 'inline-size'}; }`],
                  ],
                  u
                )
              }
              continue
            }
            let d = D(l, de, me)
            if (t.isReactNative && l.startsWith('data-')) {
              ;((l = l.replace('data-', '')), (q.dataSet ||= {}), (q.dataSet[l] = c))
              continue
            }
            if ('dataSet' === l) {
              for (const e in c) q[`data-${G(e)}`] = c[e]
              continue
            }
            if (!ge) {
              if (
                'disabled' === l &&
                !0 === c &&
                ((q['aria-disabled'] = !0),
                ('button' === s ||
                  'form' === s ||
                  'input' === s ||
                  'select' === s ||
                  'textarea' === s) &&
                  (q.disabled = !0),
                !z?.disabled)
              )
                continue
              if ('testID' === l) {
                q[F ? l : 'data-testid'] = c
                continue
              }
              if ('id' === l || 'nativeID' === l) {
                q.id = c
                continue
              }
              let e = !1
              if (F) {
                if (l in g.accessibilityDirectMap || l.startsWith('accessibility')) {
                  q[l] = c
                  continue
                }
              } else {
                if (((e = !0), l in g.accessibilityDirectMap)) {
                  q[g.accessibilityDirectMap[l]] = c
                  continue
                }
                switch (l) {
                  case 'accessibilityRole':
                    q.role = 'none' === c ? 'presentation' : Y[c] || c
                    continue
                  case 'accessibilityLabelledBy':
                  case 'accessibilityFlowTo':
                  case 'accessibilityControls':
                  case 'accessibilityDescribedBy':
                    q[`aria-${l.replace('accessibility', '').toLowerCase()}`] =
                      ((Se = c), Array.isArray(Se) ? Se.join(' ') : Se)
                    continue
                  case 'accessibilityKeyShortcuts':
                    Array.isArray(c) && (q['aria-keyshortcuts'] = c.join(' '))
                    continue
                  case 'accessibilityLiveRegion':
                    q['aria-live'] = 'none' === c ? 'off' : c
                    continue
                  case 'accessibilityReadOnly':
                    ;((q['aria-readonly'] = c),
                      ('input' === s || 'select' === s || 'textarea' === s) && (q.readOnly = !0))
                    continue
                  case 'accessibilityRequired':
                    ;((q['aria-required'] = c),
                      ('input' === s || 'select' === s || 'textarea' === s) && (q.required = c))
                    continue
                  default:
                    e = !1
                }
              }
              if (e) continue
            }
            let w = !d && z && l in z
            const N = d || w
            let I = l in p.validPseudoKeys,
              U = !N && !I && (0, v.isMediaKey)(l),
              Z = !(!U && !I)
            if (Z && l.startsWith('$group-')) {
              const e = l.split('-')
              if (2 === e.length || (3 === e.length && j.pseudoPriorities[e[e.length - 1]])) {
                const t = e[1]
                i?.groups.subscribe &&
                  !i?.groups.state[t] &&
                  (l = l.replace('$group-', '$group-true-'))
              }
            }
            const we = d || Z || (w && !ge)
            if (we && ('except-style' === pe || 'except-style-web' === pe)) continue
            const Oe = (!we && x) || (x && ve && l in ve) || V?.has(l),
              ke = ve?.[l],
              xe = !(!x || !(d || Z || ke || l in T.skipProps))
            if (((Oe || xe) && (K(q, l, c, Z), !w)) || (!be && l in T.skipProps)) continue
            ;(C || R) &&
              c &&
              ('fontFamily' === l || l === m.fontFamily) &&
              c in M.fontsParsed &&
              (fe.fontFamily = c)
            const Pe = Z || !N
            ;(0, E.propMapper)(l, c, fe, Pe, (t, n) => {
              const s = a.styledContextProps && t in a.styledContextProps
              if (x || !Pe || s || Z) {
                if (null != n && !(t in ee))
                  if (x || !D(t, de, me)) {
                    if (
                      ((I = t in p.validPseudoKeys),
                      (U = !I && (0, v.isMediaKey)(t)),
                      (Z = !(!U && !I)),
                      (w = z && t in z),
                      (V?.has(t) ||
                        ('is_static' ===
                          { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.IS_STATIC &&
                          B?.has(t))) &&
                        (q[t] = e[t] ?? n),
                      (a.noExpand && I) || (x && (Z || H?.variants?.[l])))
                    )
                      K(q, t, n, Z)
                    else if (I) {
                      if (!n) return
                      const e = L(
                        fe,
                        t,
                        n,
                        a.noClass &&
                          'is_static' !==
                            { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.IS_STATIC
                      )
                      if (
                        (!te ||
                          'is_static' ===
                            { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.IS_STATIC) &&
                        ((ie ||= {}),
                        (ie[t] ||= {}),
                        'is_static' ===
                          { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.IS_STATIC)
                      )
                        return void Object.assign(ie[t], e)
                      const r = j.pseudoDescriptors[t],
                        l = 'enterStyle' === t,
                        i = 'exitStyle' === t
                      if (!r) return
                      if (te && !i) {
                        const t = (0, O.getStyleAtomic)(e, r)
                        for (const e of t) {
                          const t = `${e[p.StyleObjectProperty]}${A}${r.name}`
                          t in ee || (W(ne, e, u), (re[t] = e[p.StyleObjectIdentifier]))
                        }
                      }
                      if (!te || i || l) {
                        const s = r.stateKey || r.name
                        let u = !1 === o[s]
                        ;(i && (u = !a.isExiting), l && !1 === o.unmounted && (u = !0))
                        const c = r.priority
                        for (const n in e) {
                          const r = e[n]
                          u
                            ? J(n, fe)
                            : c >= (ee[n] || 0) &&
                              ('is_static' ===
                                { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.IS_STATIC &&
                                ((ie ||= {}), (ie[t] ||= {}), (ie[t][n] = r)),
                              $(fe, n, r))
                        }
                        if (!u)
                          for (const e in n) {
                            const t = m[e] || e
                            ee[t] = Math.max(c, ee[t] || 0)
                          }
                      }
                    } else if (U) {
                      if (!n) return
                      const e = n.space,
                        l = t.slice('theme' == U ? 7 : 1)
                      if (
                        ((ue ||= !0),
                        (e || !te || a.willBeAnimated) &&
                          ((!ue || 'boolean' == typeof ue) && (ue = new Set()), ue.add(l)),
                        'platform' === U && !(0, P.isActivePlatform)(t))
                      )
                        return
                      if (te) {
                        const r = L(fe, t, n, !1)
                        if (e && (delete r.space, X[l])) {
                          const e = (0, v.getMediaImportanceIfMoreImportant)(l, 'space', ee, !0)
                          e && ((se = n.space), (ee.space = e))
                        }
                        const o = (0, O.getCSSStylesAtomic)(r),
                          a = ce
                        ce += 1
                        for (const e of o) {
                          const t = e[p.StyleObjectProperty],
                            n = '$' === t[0]
                          if (n && !(0, P.isActivePlatform)(t)) continue
                          const r = (0, S.createMediaStyle)(e, l, v.mediaQueryConfig, U, !1, a),
                            o = n ? e[2] : '',
                            i = `${e[p.StyleObjectProperty]}${o}${A}${l}${e[p.StyleObjectPseudo] || ''}`
                          i in ee || (W(ne, r, u), (re[i] = r[p.StyleObjectIdentifier]))
                        }
                      } else {
                        let e = function (e, t) {
                          ;((fe.style ||= {}),
                            Q(fe, l, e, t, ee, X[l], d) &&
                              'fontFamily' === e &&
                              (fe.fontFamily = u.fontFamily))
                        }
                        const a = 'theme' === U,
                          s = 'group' === U
                        if (!a && 'platform' !== U && !s && !X[l]) return
                        const u = L(fe, t, n, !0)
                        let d = 0
                        if (a) {
                          if (((oe = !0), f.isIos && (0, h.getSetting)('fastSchemeChange'))) {
                            fe.style ||= {}
                            const e = l,
                              t = (0, b.getOppositeScheme)(l)
                            for (const n in u) {
                              let r = (0, b.extractValueFromDynamic)(u[n], e)
                              const o = (0, b.extractValueFromDynamic)(fe.style[n], t)
                              ;((u[n] = (0, b.getDynamicVal)({
                                scheme: e,
                                val: r,
                                oppositeVal: o,
                              })),
                                $(fe, n, u[n]))
                            }
                          } else if (r !== l && !r.startsWith(l)) return
                        } else if (s) {
                          const e = (0, k.getGroupPropParts)(l),
                            t = e.name,
                            n = i?.groups.state[t]
                          if (!n) return
                          const r = e.pseudo,
                            a = e.media,
                            s = o.group?.[t]
                          if (a) {
                            ;((le ||= new Set()), le.add(a))
                            const e = s?.media
                            let t = e?.[a]
                            if ((!e && n.layout && (t = (0, v.mediaKeyMatch)(a, n.layout)), !t)) {
                              for (const e in u) J(e, fe)
                              return
                            }
                            d = 2
                          }
                          if (r) {
                            ;((ae ||= new Set()), ae.add(t))
                            const e = (s || i.groups.state[t]).pseudo?.[r],
                              n = j.pseudoPriorities[r]
                            if (!e) {
                              for (const e in u) J(e, fe)
                              return
                            }
                            d = n
                          }
                        }
                        for (const t in u)
                          if ('space' !== t)
                            if ('$' === t[0]) {
                              if (!(0, P.isActivePlatform)(t) || !(0, _.isActiveTheme)(t, r))
                                continue
                              for (const n in u[t]) e(n, u[t][n])
                            } else e(t, u[t])
                          else se = c.space
                      }
                    } else if (!w) {
                      if (s) return
                      q[t] = n
                    }
                  } else $(fe, t, n)
              } else q[t] = n
            })
          }
          var Se
          if (
            !1 !== a.noNormalize &&
            (fe.style &&
              ((0, w.fixStyles)(fe.style),
              !a.noExpand && !a.noMergeStyle && f.isWeb && !F && (0, O.styleToCSS)(fe.style)),
            fe.flatTransforms && ((fe.style ||= {}), I(fe.style, fe.flatTransforms)),
            l)
          ) {
            if (te)
              for (const e in l.classNames) {
                const t = l.classNames[e]
                ;(fe.style && e in fe.style) || e in re || (re[e] = t)
              }
            if (!te)
              for (const e in l.style)
                e in re ||
                  (fe.style && e in fe.style) ||
                  ((fe.style ||= {}), (fe.style[e] = l.style[e]))
          }
          if (
            (!a.noNormalize &&
              !t.isReactNative &&
              !t.isHOC &&
              (!a.isAnimated || d.supportsCSSVars) &&
              Array.isArray(fe.style?.transform) &&
              (fe.style.transform = (0, N.transformsToString)(fe.style.transform)),
            !a.noMergeStyle && fe.style && te)
          ) {
            let t,
              n = !1
            if (!fe.style.$$css) {
              const r = (0, O.getCSSStylesAtomic)(fe.style)
              for (const o of r) {
                const [r, l, i] = o,
                  s = a.isAnimated && a.noClass && e.animateOnly?.includes(r),
                  c = !s && !a.isAnimated && e.animateOnly?.includes(r)
                s
                  ? ((t ||= {}), (t[r] = fe.style[r]))
                  : c
                    ? ((t ||= {}), (t[r] = l), (n = !0))
                    : (W(ne, o, u), (re[r] = i))
              }
              ;(n ||
                'is_static' !== { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.IS_STATIC) &&
                (fe.style = t || {})
            }
          }
          if (F) 0 === q.tabIndex && (q.accessible ??= !0)
          else if (null == q.tabIndex) {
            const t = q.focusable ?? q.accessible
            q.focusable && delete q.focusable
            const n = q.role
            ;(!1 === t && (q.tabIndex = '-1'),
              'a' === s || 'button' === s || 'input' === s || 'select' === s || 'textarea' === s
                ? (!1 === t || !0 === e.accessibilityDisabled) && (q.tabIndex = '-1')
                : ('button' === n ||
                    'checkbox' === n ||
                    'link' === n ||
                    'radio' === n ||
                    'textbox' === n ||
                    'switch' === n) &&
                  !1 !== t &&
                  (q.tabIndex = '0'),
              t && ((q.tabIndex = '0'), delete q.focusable))
          }
          const we = e.style
          if (!a.noMergeStyle && we)
            if (x) q.style = Z(we)
            else {
              const e = Array.isArray(we),
                t = e ? we.length : 1
              for (let n = 0; n < t; n++) {
                const t = e ? we[n] : we
                t &&
                  (t.$$css
                    ? Object.assign(fe.classNames, t)
                    : ((fe.style ||= {}), Object.assign(fe.style, Z(t))))
              }
            }
          const Oe = {
              space: se,
              hasMedia: ue,
              fontFamily: fe.fontFamily,
              viewProps: q,
              style: fe.style,
              pseudos: ie,
              classNames: re,
              rulesToInsert: ne,
              dynamicThemeAccess: oe,
              pseudoGroups: ae,
              mediaGroups: le,
            },
            ke = 'except-style' === pe || 'except-style-web' === pe
          if (!a.noMergeStyle && !ke) {
            const n = fe.style
            {
              let r = C || R ? fe.fontFamily || t.defaultProps?.fontFamily : null
              r && '$' === r[0] && (r = r.slice(1))
              const o = r ? `font_${r}` : '',
                l = e.group ? `t_group_${e.group}` : '',
                i = e.componentName || t.componentName,
                s = e.asChild || !i ? '' : `is_${i}`
              let u = []
              ;(s && u.push(s),
                o && u.push(o),
                re && u.push(Object.values(re).join(' ')),
                l && u.push(l),
                e.className && u.push(e.className))
              const c = u.join(' ')
              if (a.isAnimated) n && (q.style = n)
              else if (F) {
                const e = { $$css: !0 }
                for (const t of c.split(' ')) e[t] = t
                q.style = [...(Array.isArray(n) ? n : [n]), e]
              } else (c && (q.className = c), n && (q.style = n))
            }
          }
          return Oe
        }
        function I(e, t) {
          Object.entries(t)
            .sort(([e], [t]) => (0, R.sortString)(e, t))
            .forEach(([t, n]) => {
              q(e, t, n, !0)
            })
        }
        function $(e, t, n, r = !1) {
          const { viewProps: o, styleProps: a, staticConfig: l } = e
          if (t in p.stylePropsTransform) ((e.flatTransforms ||= {}), (e.flatTransforms[t] = n))
          else {
            const i = !f.isWeb || r || a.noNormalize ? n : (0, C.normalizeValueWithProperty)(n, t)
            l.accept && t in l.accept
              ? (o[t] = i)
              : ((e.style ||= {}),
                (e.style[t] = 'transform' === t && Array.isArray(i) ? [...i] : i))
          }
        }
        const L = (e, t, n, r) => {
            const { staticConfig: o, conf: a, styleProps: l } = e,
              i = {}
            for (let t in n) {
              const s = n[t]
              ;((t = a.shorthands[t] || t),
                (o.isHOC || !(t in T.skipProps) || l.noSkip) &&
                  (0, E.propMapper)(t, s, e, !1, (n, o) => {
                    ;(n in p.validPseudoKeys && (o = L(e, n, o, r)),
                      !r && n in p.stylePropsTransform
                        ? q(i, n, o)
                        : (i[n] = l.noNormalize ? o : (0, C.normalizeValueWithProperty)(o, t)))
                  }))
            }
            if (!r) {
              if (Array.isArray(i.transform)) {
                const t = e.style?.transform
                t && (i.transform = [...t, ...i.transform])
              }
              e.flatTransforms && I(i, e.flatTransforms)
            }
            return (l.noNormalize || (0, w.fixStyles)(i), i)
          },
          F = f.isWeb ? m.default.useInsertionEffect || f.useIsomorphicLayoutEffect : () => {},
          V = (e, t, n, r, o, a, l, i, s, u, c) => {
            const d = z(e, t, n, r, o, a, l, i, s, u, c)
            return (
              u ||
                F(() => {
                  ;(0, x.insertStyleRules)(d.rulesToInsert)
                }, [d.rulesToInsert]),
              d
            )
          }
        function W(e, t, n = !1) {
          {
            const r = t[p.StyleObjectIdentifier]
            n
              ? (e[r] = t)
              : (0, x.shouldInsertStyleRules)(r) &&
                ((0, x.updateRules)(r, t[p.StyleObjectRules]), (e[r] = t))
          }
        }
        const B =
            { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_DEFAULT_COLOR ||
            'rgba(0,0,0,0)',
          H = {
            ...Object.fromEntries(Object.entries(p.tokenCategories.color).map(([e, t]) => [e, B])),
            opacity: 1,
            scale: 1,
            rotate: '0deg',
            rotateY: '0deg',
            rotateX: '0deg',
            x: 0,
            y: 0,
            borderRadius: 0,
          },
          U = (e) => `-${e.toLowerCase()}`,
          G = (e) => e.replace(/[A-Z]/g, U),
          q = (e, t, n, r = !1) => {
            'string' != typeof e.transform &&
              ((e.transform ||= []), e.transform[r ? 'unshift' : 'push']({ [X[t] || t]: n }))
          },
          X = { x: 'translateX', y: 'translateY' },
          Y = {
            adjustable: 'slider',
            header: 'heading',
            image: 'img',
            link: 'link',
            none: 'presentation',
            summary: 'region',
          }
        function K(e, t, n, r = !1) {
          if (r) {
            const r = { ...e[t], ...n }
            ;(delete e[t], (e[t] = r))
          } else e[t] = n
        }
        function Q(e, t, n, r, o, a, l, i) {
          let s = (0, v.getMediaImportanceIfMoreImportant)(t, n, o, a)
          if ((l && (s = (s || 0) + l), null === s)) return !1
          if (((o[n] = s), n in j.pseudoDescriptors)) {
            const t = j.pseudoDescriptors[n],
              o = t.stateKey || t.name
            if (!1 === e.componentState[o]) return !1
            for (const t in r) $(e, t, r[t])
          } else $(e, n, r)
          return !0
        }
        function Z(e) {
          const t = {}
          for (const n in e) {
            const r = e[n]
            n in p.stylePropsTransform
              ? q(t, n, r)
              : (t[n] = (0, C.normalizeValueWithProperty)(r, n))
          }
          return (
            f.isWeb &&
              Array.isArray(t.transform) &&
              (t.transform = (0, N.transformsToString)(t.transform)),
            (0, w.fixStyles)(t),
            t
          )
        }
        function J(e, t) {
          const n = H[e]
          null != n && !(e in t.usedKeys) && (!t.style || !(e in t.style)) && $(t, e, n)
        }
      },
      7837: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { getThemeCSSRules: () => g }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(6013),
          c = n(9991),
          d = n(2034),
          f = n(4392),
          p = n(2544),
          m = n(5539)
        const b = ['dark', 'light'],
          h = ['light', 'dark']
        function g(e) {
          const t = []
          if (
            !{ __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_DOES_SSR_CSS ||
            'mutates-themes' ===
              { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_DOES_SSR_CSS ||
            'false' === { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_DOES_SSR_CSS
          ) {
            const { config: n, themeName: r, theme: o, names: a } = e,
              l = e.hasDarkLight ?? (n.themes && ('light' in n.themes || 'dark' in n.themes)),
              i = `.${c.THEME_CLASSNAME_PREFIX}`
            let s = ''
            for (const e in o) {
              const t = o[e]
              let n = null
              ;((n = f.tokensValueToVariable.has(t.val)
                ? f.tokensValueToVariable.get(t.val).variable
                : t.val),
                (s += `--${{ __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_CSS_VARIABLE_PREFIX || ''}${(0, u.simpleHash)(e, 40)}:${n};`))
            }
            const g = 'dark' === r,
              w = 'light' === r,
              O = a.map((e) => `${i}${e}`),
              k = new Set(g || w ? O : [])
            if (l) {
              const e = (0, p.getSetting)('maxDarkLightNesting') ?? 3
              for (const t of a) {
                const n = g || t.startsWith('dark_'),
                  r = !n && (w || t.startsWith('light_'))
                if (!n && !r) {
                  k.add(`${i}${t}`)
                  continue
                }
                const o = `${i}${t.replace(/^(dark|light)_/, '')}`,
                  a = n ? b : h,
                  [l, s] = a,
                  u = Math.round(1.5 * e)
                for (let e = 0; e < u; e++) {
                  const t = e % 2 == 1
                  if (t && e < 3) continue
                  const n = new Array(e + 1).fill(0).map((e, t) => `${i}${t % 2 == 0 ? l : s}`)
                  let r = n.length > 1 ? n.slice(1) : n
                  if (t) {
                    const [e, t, ...n] = r
                    r = [t, ...n, t]
                  }
                  const a = o === r[r.length - 1] ? '' : o,
                    u = r.join(' ')
                  k.add(`${u} ${a}`)
                }
              }
            }
            const x = [...k].sort(m.sortString),
              P = `${x.map((e) => `:root${S(e) && (0, p.getSetting)('themeClassNameOnRoot') ? '' : ' '}${e}`).join(', ') + ', .tm_xxt'} {${s}}`
            if ((t.push(P), (0, p.getSetting)('shouldAddPrefersColorThemes'))) {
              const e = `body{${o.background ? `background:${(0, d.variableToString)(o.background)};` : ''}${o.color ? `color:${(0, d.variableToString)(o.color)}` : ''}}`,
                n = r.startsWith('dark'),
                a = `@media(prefers-color-scheme:${n ? 'dark' : 'light'}){\n    ${e}\n    ${x
                  .map((e) =>
                    e == y || e === v
                      ? ':root'
                      : (n && e.startsWith(v)) || (!n && e.startsWith(y))
                        ? void 0
                        : e.replace(/^\.t_(dark|light) /, '').trim()
                  )
                  .filter(Boolean)
                  .join(', ')} {${s}}\n  }`
              t.push(a)
            }
            const _ = (0, p.getSetting)('selectionStyles')
            if (_) {
              const e = _(o)
              if (e) {
                const n = O.map((e) => `${e} ::selection`).join(', '),
                  r = Object.entries(e)
                    .flatMap(([e, t]) =>
                      t
                        ? `${'backgroundColor' === e ? 'background' : e}:${(0, d.variableToString)(t)}`
                        : []
                    )
                    .join(';')
                if (r) {
                  const e = `${n}{${r}}`
                  t.push(e)
                }
              }
            }
          }
          return t
        }
        const y = '.t_dark',
          v = '.t_light',
          S = (e) => e === y || e === v || e.startsWith('.t_dark ') || e.startsWith('.t_light ')
      },
      7718: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { getFontsForLanguage: () => p, getVariantExtras: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(2034)
        const c = new WeakMap(),
          d = (e) => {
            if (c.has(e)) return c.get(e)
            const { props: t, conf: n, context: r, theme: o } = e
            let a = n.fontsParsed
            r?.language && (a = p(n.fontsParsed, r.language))
            const l = {
              fonts: a,
              tokens: n.tokensParsed,
              theme: o,
              get fontFamily() {
                return (
                  (0, u.getVariableValue)(e.fontFamily || e.props.fontFamily) ||
                  t.fontFamily ||
                  (0, u.getVariableValue)(e.conf.defaultFont)
                )
              },
              get font() {
                return (
                  a[this.fontFamily] ||
                  (t.fontFamily && '$' !== t.fontFamily[0] ? void 0 : a[e.conf.defaultFont])
                )
              },
              props: t,
            }
            return (c.set(e, l), l)
          },
          f = new WeakMap()
        function p(e, t) {
          if (f.has(t)) return f.get(t)
          const n = {
            ...e,
            ...Object.fromEntries(
              Object.entries(t).map(([t, n]) => ('default' === n ? [] : [`$${t}`, e[`$${t}_${n}`]]))
            ),
          }
          return (f.set(t, n), n)
        }
      },
      1364: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          getAllRules: () => y,
          getAllSelectors: () => g,
          getAllTransforms: () => v,
          insertStyleRules: () => $,
          insertedTransforms: () => h,
          listenForSheetChanges: () => w,
          scanAllSheets: () => k,
          setNonce: () => I,
          shouldInsertStyleRules: () => F,
          updateRules: () => D,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(6013),
          d = n(2034)
        const f = new WeakMap(),
          p = new Map(),
          m = {},
          b = {},
          h = {},
          g = () => m,
          y = () => Object.values(b),
          v = () => h
        function S(e, t, n) {
          const r = t.indexOf('transform:')
          if (-1 === r) return
          const o = r + 10,
            a = t.indexOf(';'),
            l = t.slice(o, a)
          return h[e] ? void 0 : ((h[e] = l), !0)
        }
        function w() {
          u.isClient &&
            new MutationObserver((e) => {
              for (const t of e)
                if (
                  (t instanceof HTMLStyleElement && t.sheet) ||
                  (t instanceof HTMLLinkElement && t.href.endsWith('.css'))
                ) {
                  k()
                  break
                }
            }).observe(document.head, { childList: !0 })
        }
        let O = null
        function k(e = !1, t) {
          if (!u.isClient) return
          let n
          const r = document.styleSheets || [],
            o = O,
            a = new Set(r)
          for (const r of a)
            if (r) {
              const o = C(r, !1, e, t)
              o && (n = o)
            }
          if (((O = a), o)) for (const e of o) e && !a.has(e) && C(e, !0)
          return n
        }
        function x(e, t = !1) {
          const n = (p.get(e) || 0) + (t ? -1 : 1)
          return (p.set(e, n), n)
        }
        const P = { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }
            .TAMAGUI_BAIL_AFTER_SCANNING_X_CSS_RULES,
          _ = P ? +P : 700
        function C(e, t = !1, n = !1, r) {
          let o
          try {
            if (((o = e.cssRules), !o)) return
          } catch {
            return
          }
          const a = N(o[0], n)?.[0],
            l = N(o[o.length - 1], n)?.[0],
            i = `${o.length}${a}${l}`,
            s = f.get(e)
          if (!t && s === i) return
          const u = o.length
          let c,
            d = 0
          const p = {}
          for (let e = 0; e < u; e++) {
            const a = o[e]
            if (!(a instanceof CSSStyleRule)) continue
            const l = N(a, n)
            if (!l) {
              if ((d++, d > _)) return
              continue
            }
            d = 0
            const [i, s, u] = l
            if (u) {
              const e = T(s, r)
              if (e) {
                for (const t of e.names)
                  p[t]
                    ? (Object.apply(p[t], e.theme), (e.names = e.names.filter((e) => e !== t)))
                    : (p[t] = e.theme)
                ;((c ||= []), c.push(e))
              }
              continue
            }
            const f = x(i, t)
            t
              ? 0 === f && delete m[i]
              : i in m || ((!i.startsWith('_transform-') || S(i, s.cssText)) && (m[i] = s.cssText))
          }
          return (f.set(e, i), c)
        }
        let E,
          j = null
        function T(e, t) {
          const n = e.selectorText.split(',')
          if (!n.length) return
          if (t?.color && !E) {
            E = {}
            for (const e in t.color) {
              const n = t.color[e]
              E[n.name] = n.val
            }
          }
          const r = (e.cssText || '').slice(e.selectorText.length + 2, -1).split(';'),
            o = {}
          for (const e of r) {
            const t = e.indexOf(':')
            if (-1 === t) continue
            const n = e.indexOf('--')
            let r = e.slice(-1 === n ? 0 : n + 2, t)
            ;({ __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }).TAMAGUI_CSS_VARIABLE_PREFIX &&
              (r = r.replace(
                { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_CSS_VARIABLE_PREFIX,
                ''
              ))
            const a = e.slice(t + 2)
            let l
            if ('v' === a[0] && a.startsWith('var(')) {
              const e = a.slice(6, -1),
                t = E[e]
              t
                ? (l = t)
                : ((j ||= getComputedStyle(document.body)), (l = j.getPropertyValue('--' + e)))
            } else l = a
            o[r] = (0, d.createVariable)({ key: r, name: r, val: l }, !0)
          }
          const a = new Set()
          for (const e of n) {
            if (' .tm_xxt' === e) continue
            const t = e.lastIndexOf('.t_'),
              n = e.slice(t).slice(3),
              [r] = e[t - 5],
              o = 'd' === r ? 'dark' : 'i' === r ? 'light' : '',
              l = o && o !== n ? `${o}_${n}` : n
            !l || 'light_dark' === l || 'dark_light' === l || a.add(l)
          }
          return { names: [...a], theme: o }
        }
        const R = /\.tm_xxt/
        function N(e, t = !1) {
          if (e instanceof CSSStyleRule) {
            const n = e.selectorText
            if (':' === n[0] && 'r' === n[1] && R.test(n)) {
              const r = M(n.replace(R, ''))
              return t ? [r, e, !0] : [r, e]
            }
          } else if (e instanceof CSSMediaRule)
            return e.cssRules.length > 1 ? void 0 : N(e.cssRules[0])
        }
        const M = (e) => {
          const t = e.indexOf(':')
          return t > -1 ? e.slice(7, t) : e.slice(7)
        }
        let A = null
        function D(e, t) {
          return !(e in b) && ((b[e] = t.join(' ')), !e.startsWith('_transform-') || S(e, t[0]))
        }
        let z = ''
        function I(e) {
          z = e
        }
        function $(e) {
          if (!A && u.isClient && document.head) {
            const e = document.createElement('style')
            ;(z && (e.nonce = z), (A = document.head.appendChild(e).sheet))
          }
          if (A)
            for (const t in e) {
              const n = e[t],
                r = n[c.StyleObjectIdentifier]
              if (!F(r)) continue
              const o = n[c.StyleObjectRules]
              ;((m[r] = o.join('\n')), x(r), D(r, o))
              for (const e of o)
                try {
                  A.insertRule(e, A.cssRules.length)
                } catch (e) {
                  console.error('Error inserting CSS', e)
                }
            }
        }
        const L = { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_INSERT_SELECTOR_TRIES
          ? +{ __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_INSERT_SELECTOR_TRIES
          : 1
        function F(e) {
          if ('is_static' === { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.IS_STATIC)
            return !0
          const t = p.get(e)
          return void 0 === t || t < L
        }
      },
      3815: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { isActivePlatform: () => c }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277)
        function c(e) {
          if (!e.startsWith('$platform')) return !0
          const t = e.slice(10)
          return t === u.currentPlatform || 'web' === t
        }
      },
      8445: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i(e, t) {
          if (e.startsWith('$theme-')) return e.slice(7).startsWith(t)
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { isActiveTheme: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
      },
      7163: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { isObj: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = (e) => e && !Array.isArray(e) && 'object' == typeof e
      },
      4577: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i(e, t) {
          const n = e?.staticConfig
          return !(!n || (t && t !== n.componentName))
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { isTamaguiComponent: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
      },
      2404: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { isTamaguiElement: () => m }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          p = n(4577)
        const m = (e, t) => f.default.isValidElement(e) && (0, p.isTamaguiComponent)(e.type, t)
      },
      7522: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        function u(...e) {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { log: () => u }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))),
          n(3750))
      },
      8353: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { matchMedia: () => i, setupMatchMedia: () => s }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i =
          (typeof window < 'u' && window.matchMedia) ||
          function (e) {
            return { match: (e, t) => !1, addListener() {}, removeListener() {}, matches: !1 }
          }
        function s(e) {}
      },
      9194: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { mergeProps: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(3750),
          c = n(4572)
        const d = (e, t, n) => {
          const r = {}
          for (const o in e) f(r, e, t, o, n)
          if (t) for (const e in t) f(r, t, void 0, e, n)
          return r
        }
        function f(e, t, n, r, o) {
          const a = o?.[r] || null,
            l = t[r]
          if (!n || !(r in n || (a && a in n))) {
            if (r in c.pseudoDescriptors || u.mediaKeys.has(r))
              return void (e[r] = { ...e[r], ...l })
            e[a || r] = l
          }
        }
      },
      2682: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { mergeVariants: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = (e, t, n = 0) => {
          const r = {}
          for (const o in t) {
            const a = e?.[o],
              l = t[o]
            r[o] =
              a && 'function' != typeof l
                ? a && !l
                  ? a[o]
                  : 0 === n
                    ? i(a, l, n + 1)
                    : { ...a, ...l }
                : l
          }
          return { ...e, ...r }
        }
      },
      3898: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { getRgba: () => f, normalizeColor: () => d, rgba: () => c.rgba }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(5307),
          c = n(5307)
        const d = (e, t) => {
            if (e) {
              if ('$' === e[0]) return e
              if (e.startsWith('var(')) {
                if ('number' == typeof t && t < 1)
                  return `color-mix(in srgb, ${e} ${100 * t}%, transparent)`
              } else {
                const n = f(e)
                if (n) {
                  const e = `${n.r},${n.g},${n.b}`
                  return 1 === t ? `rgb(${e})` : `rgba(${e},${t ?? n.a ?? 1})`
                }
              }
              return e
            }
          },
          f = (e) => {
            const t = (0, u.normalizeCSSColor)(e)
            if (null != t) return (0, u.rgba)(t)
          }
      },
      3149: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { normalizeShadow: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(3282),
          c = n(3898)
        function d({ shadowColor: e, shadowOffset: t, shadowOpacity: n, shadowRadius: r }) {
          const { height: o, width: a } = t || u.defaultOffset
          return {
            shadowOffset: { width: a || 0, height: o || 0 },
            shadowRadius: r || 0,
            shadowColor: (0, c.normalizeColor)(e, 1),
            shadowOpacity: n ?? (e ? (0, c.getRgba)(e)?.a : 1),
          }
        }
      },
      2224: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { normalizeStyle: () => m }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(2723),
          c = n(7642),
          d = n(7163),
          f = n(5687),
          p = n(4572)
        function m(e, t = !1) {
          const n = {}
          for (let r in e) {
            const o = e[r]
            if (null == o) continue
            if (r in p.pseudoDescriptors || ('$' === r[0] && (0, d.isObj)(o))) {
              n[r] = m(o, t)
              continue
            }
            const a = t ? o : (0, f.normalizeValueWithProperty)(o, r),
              l = (0, u.expandStyle)(r, a)
            l ? Object.assign(n, Object.fromEntries(l)) : (n[r] = a)
          }
          return ((0, c.fixStyles)(n), n)
        }
      },
      5687: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { normalizeValueWithProperty: () => f }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(6013)
        const d = { ...c.stylePropsAll, translateX: !0, translateY: !0 }
        function f(e, t = '') {
          if (!u.isWeb || c.stylePropsUnitless[t] || (t && !d[t]) || 'boolean' == typeof e) return e
          let n = e
          return e && 'object' == typeof e
            ? e
            : ('number' == typeof e ? (n = `${e}px`) : t && (n = `${n}`), n)
        }
      },
      900: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i(e) {
          let t = ''
          for (const n in e) {
            t += n
            const r = e[n]
            let o = typeof r
            if (!r || ('object' !== o && 'function' !== o)) t += o + r
            else if (s.has(r)) t += s.get(r)
            else {
              let e = Math.random()
              ;(s.set(r, e), (t += e))
            }
          }
          return t
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { objectIdentityKey: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const s = new WeakMap()
      },
      3096: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          getFontFamilyFromNameOrVariable: () => S,
          getTokenForKey: () => _,
          propMapper: () => y,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))),
          n(1277))
        var u = n(6013),
          c = n(2544),
          d = n(2034),
          f = n(2723),
          p = n(7718),
          m = n(7163),
          b = n(2224),
          h = n(4572),
          g = n(9141)
        const y = (e, t, n, r, o) => {
            if (r) return o(e, t)
            if (((P = null), 'elevationAndroid' === e)) return
            const { conf: a, styleProps: l, staticConfig: i } = n
            if ('unset' === t) {
              const n = a.unset?.[e]
              if (null == n) return
              t = n
            }
            const { variants: s } = i
            if (!l.noExpand && s && e in s) {
              const r = v(e, t, l, n, '')
              if (r) return void r.forEach(([e, t]) => o(e, t))
            }
            if (
              (l.disableExpandShorthands || (e in a.shorthands && (e = a.shorthands[e])),
              null != t &&
                ('$' === t[0]
                  ? (t = _(e, t, l, n))
                  : (0, d.isVariable)(t) && (t = C(0, t, l.resolveValues))),
              null != t)
            ) {
              'fontFamily' === e && P && (n.fontFamily = P)
              const r = l.noExpand ? null : (0, f.expandStyle)(e, t)
              if (r) {
                const e = r.length
                for (let t = 0; t < e; t++) {
                  const [e, n] = r[t]
                  o(e, n)
                }
              } else o(e, t)
            }
          },
          v = (e, t, n, r, o) => {
            const { staticConfig: a, conf: l, debug: i } = r,
              { variants: s } = a
            if (!s) return
            let u,
              c = (function (e, t, n) {
                if (!e) return
                if ('function' == typeof e) return e
                const r = e[t]
                if (r) return r
                if (null != t) {
                  const { tokensParsed: r } = n
                  for (const { name: n, spreadName: o } of k)
                    if (o in e && n in r && t in r[n]) return e[o]
                  const o = e['...fontSize']
                  if (o && n.fontSizeTokens.has(t)) return o
                }
                return e[':' + typeof t] || e['...']
              })(s[e], t, l)
            if (c) {
              if (
                ('function' == typeof c && (c = c(t, (0, p.getVariantExtras)(r))), (0, m.isObj)(c))
              ) {
                const t = c.fontFamily || c[l.inverseShorthands.fontFamily]
                ;(t && ((u = S(t, l)), (r.fontFamily = u)), (c = O(e, c, n, r, o)))
              }
              if (c) {
                const e = (0, b.normalizeStyle)(c, !!n.noNormalize),
                  t = Object.entries(e)
                return (u && '$' === u[0] && (P = (0, d.getVariableValue)(u)), t)
              }
            } else if (
              '1' ===
                { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }
                  .TAMAGUI_WARN_ON_MISSING_VARIANT &&
              'boolean' != typeof t
            ) {
              const n = a.componentName || '[UnnamedComponent]'
              console.warn(
                `No variant found: ${n} has variant "${e}", but no matching value "${t}"`
              )
            }
          }
        function S(e, t) {
          if ((0, d.isVariable)(e)) {
            const n = w.get(e)
            if (n) return n
            for (const n in t.fontsParsed) {
              const r = t.fontsParsed[n].family
              if ((0, d.isVariable)(r) && (w.set(r, n), r === e)) return n
            }
          } else if ('string' == typeof e && '$' === e[0]) return e
        }
        const w = new WeakMap(),
          O = (e, t, n, r, o) => {
            const { conf: a, staticConfig: l, debug: i, theme: s } = r,
              { variants: u } = l,
              c = {}
            for (const l in t) {
              const i = a.shorthands[l] || l,
                s = t[l]
              if (n.noSkip || !(i in g.skipProps)) {
                if (n.noExpand) c[i] = s
                else if (u && i in u) {
                  if (o && o === e) c[i] = '$' === s[0] ? _(i, s, n, r) : s
                  else {
                    const t = v(i, s, n, r, e)
                    if (t)
                      for (const [e, n] of t)
                        null != n &&
                          (e in h.pseudoDescriptors
                            ? ((c[e] ??= {}), Object.assign(c[e], n))
                            : (c[e] = n))
                  }
                  continue
                }
                if ((0, d.isVariable)(s)) {
                  c[i] = C(0, s, n.resolveValues)
                  continue
                }
                if ('string' == typeof s) {
                  const e = '$' === s[0] ? _(i, s, n, r) : s
                  c[i] = e
                  continue
                }
                if ((0, m.isObj)(s)) {
                  const t = O(i, s, n, r, e)
                  ;((c[i] ??= {}), Object.assign(c[i], t))
                } else c[i] = s
              }
            }
            return c
          },
          k = ['size', 'color', 'radius', 'space', 'zIndex'].map((e) => ({
            name: e,
            spreadName: `...${e}`,
          })),
          x = { fontSize: 'size', fontWeight: 'weight' }
        let P = null
        const _ = (e, t, n, r) => {
          let o = n.resolveValues || 'none'
          if ('none' === o) return t
          const {
              theme: a,
              conf: l = (0, c.getConfig)(),
              context: i,
              fontFamily: s,
              staticConfig: d,
            } = r,
            f = a ? a[t] || a[t.slice(1)] : void 0,
            m = l.tokensParsed
          let b,
            h = !1
          const g = d?.accept?.[e]
          if (g) {
            const e = f ?? m[g][t]
            null != e && ((o = 'value'), (b = e), (h = !0))
          }
          if (f) {
            if ('except-theme' === o) return t
            ;((b = f), (h = !0))
          } else {
            if (t in l.specificTokens) ((h = !0), (b = l.specificTokens[t]))
            else {
              switch (e) {
                case 'fontFamily':
                  ;((b =
                    (i?.language
                      ? (0, p.getFontsForLanguage)(l.fontsParsed, i.language)
                      : l.fontsParsed)[t]?.family || t),
                    (P = t),
                    (h = !0))
                  break
                case 'fontSize':
                case 'lineHeight':
                case 'letterSpacing':
                case 'fontWeight': {
                  const n = s || l.defaultFontToken
                  if (n) {
                    const r = i?.language
                      ? (0, p.getFontsForLanguage)(l.fontsParsed, i.language)
                      : l.fontsParsed
                    ;((b = (r[n] || r[l.defaultFontToken])?.[x[e] || e]?.[t] || t), (h = !0))
                  }
                  break
                }
              }
              for (const n in u.tokenCategories)
                if (e in u.tokenCategories[n]) {
                  const e = m[n][t]
                  null != e && ((b = e), (h = !0))
                }
            }
            if (!h) {
              const e = m.space[t]
              null != e && ((b = e), (h = !0))
            }
          }
          return h ? C(0, b, o) : void 0
        }
        function C(e, t, n) {
          if ('none' === n) return t
          if ((0, d.isVariable)(t)) {
            if ('value' === n) return t.val
            const e = t?.get
            return 'function' == typeof e ? e('web' === n ? 'web' : void 0) : t.variable
          }
          return t
        }
      },
      163: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { proxyThemeToParents: () => u, proxyThemesToParents: () => s }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = {}
        function s(e) {
          for (const { names: t, theme: n } of e) for (const e of t) i[e] = n
          const t = {}
          for (const { names: n, theme: r } of e)
            for (const e of n) {
              const n = u(e, r)
              t[e] = n
            }
          return t
        }
        function u(e, t) {
          const n = {},
            r = [],
            o = e
              .split('_')
              .slice(0, -1)
              .map((e) => (r.push(e), r.join('_')))
          for (const e of o) Object.assign(n, i[e])
          return (Object.assign(n, t), n)
        }
      },
      3178: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i(e) {
          return new Proxy(e || {}, {
            has: (e, t) => Reflect.has(e, s(t)),
            get: (e, t) => Reflect.get(e, s(t)),
          })
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { proxyThemeVariables: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const s = (e) => ('string' == typeof e && '$' === e[0] ? e.slice(1) : e)
      },
      4572: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, {
          pseudoDescriptors: () => u,
          pseudoDescriptorsBase: () => i,
          pseudoPriorities: () => s,
        }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = {
            hoverStyle: { name: 'hover', priority: 1 },
            pressStyle: { name: 'active', stateKey: 'press', priority: 2 },
            focusVisibleStyle: { name: 'focus-visible', priority: 3, stateKey: 'focusVisible' },
            focusStyle: { name: 'focus', priority: 3 },
            focusWithinStyle: { name: 'focus-within', priority: 3, stateKey: 'focusWithin' },
            disabledStyle: { name: 'disabled', priority: 4, stateKey: 'disabled' },
          },
          s = { hover: 1, press: 2, focus: 3, focusVisible: 3, focusWithin: 3, disabled: 4 },
          u = {
            ...i,
            enterStyle: { name: 'enter', selector: '.t_unmounted', priority: 4 },
            exitStyle: { name: 'exit', priority: 5 },
          }
      },
      4392: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          registerCSSVariable: () => c,
          tokensValueToVariable: () => f,
          variableToCSS: () => d,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(2034)
        const c = (e) => {
            f.set((0, u.getVariableValue)(e), e)
          },
          d = (e, t = !1) =>
            `--${{ __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_CSS_VARIABLE_PREFIX || ''}${(0, u.createCSSVariable)(e.name, !1)}:${t || 'number' != typeof e.val ? e.val : `${e.val}px`}`,
          f = new Map()
      },
      9734: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { setElementProps: () => c }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(6535)
        const c = (e) => {
          u.hooks.setElementProps?.(e)
        }
      },
      9141: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { skipProps: () => u }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))),
          n(5402))
        const u = {
          untilMeasured: 1,
          animation: 1,
          space: 1,
          animateOnly: 1,
          disableClassName: 1,
          debug: 1,
          componentName: 1,
          disableOptimization: 1,
          tag: 1,
          style: 1,
          group: 1,
          themeInverse: 1,
          animatePresence: 1,
        }
      },
      5539: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { sortString: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = (e, t) => (e < t ? -1 : e > t ? 1 : 0)
      },
      1597: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { subscribeToContextGroup: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(3750),
          c = n(9478)
        const d = ({
          setStateShallow: e,
          pseudoGroups: t,
          mediaGroups: n,
          componentContext: r,
          state: o,
        }) => {
          if (t || n)
            return r.groups?.subscribe?.((r, { layout: a, pseudo: l }) => {
              const i = o.group?.[r] || { pseudo: {}, media: {} }
              if (l && t?.has(String(r))) (Object.assign(i.pseudo, l), s())
              else if (a && n) {
                const e = (0, u.getMediaState)(n, a),
                  t = (0, c.mergeIfNotShallowEqual)(i.media || {}, e)
                t !== i.media && (Object.assign(i.media, t), s())
              }
              function s() {
                const t = { ...o.group, [r]: i }
                e({ group: t })
              }
            })
        }
      },
      3211: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { themeable: () => b }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          p = n(2778),
          m = n(2351)
        function b(e, t, n = !1) {
          const r = f.default.forwardRef(function (r, o) {
            const { themeInverse: a, theme: l, componentName: i, themeReset: s, ...u } = r
            let c
            const d = t?.context
            if (d)
              for (const e in d.props) {
                const t = r[e]
                void 0 !== t && ((c ||= {}), (c[e] = t))
              }
            const b = (0, m.jsx)(e, { ref: o, ...u, 'data-disable-theme': !0 })
            let h = null
            const g = i || t?.componentName
            if (
              (g && ((h ||= {}), (h.componentName = g)),
              'debug' in r && ((h ||= {}), (h.debug = r.debug)),
              'theme' in r && ((h ||= {}), (h.name = r.theme)),
              'themeInverse' in r && ((h ||= {}), (h.inverse = r.themeInverse)),
              'themeReset' in r && ((h ||= {}), (h.reset = s)),
              n && !h)
            )
              return b
            let y = (0, m.jsx)(p.Theme, { 'disable-child-theme': !0, ...h, children: b })
            if (d) {
              const e = d.Provider,
                t = f.default.useContext(d)
              y = (0, m.jsx)(e, { ...t, ...c, children: y })
            }
            return y
          })
          return ((r.displayName = `Themed(${e?.displayName || e?.name || 'Anonymous'})`), r)
        }
      },
      6706: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { ensureThemeVariable: () => c }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(2034)
        function c(e, t) {
          const n = e[t]
          ;(0, u.isVariable)(n)
            ? n.name !== t && (e[t] = (0, u.createVariable)({ key: n.name, name: t, val: n.val }))
            : (e[t] = (0, u.createVariable)({ key: t, name: t, val: n }))
        }
      },
      3691: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { transformsToString: () => c }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(5687)
        function c(e) {
          return e
            .map((e) => {
              const t = Object.keys(e)[0],
                n = e[t]
              return 'matrix' === t || 'matrix3d' === t
                ? `${t}(${n.join(',')})`
                : `${t}(${(0, u.normalizeValueWithProperty)(n, t)})`
            })
            .join(' ')
        }
      },
      5402: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { webPropsToSkip: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = {}
      },
      6403: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { getStyleTags: () => f }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(6013),
          d = n(2351)
        function f(e) {
          if (u.IS_REACT_19 && e.length)
            return (0, d.jsx)(d.Fragment, {
              children: e.map((e) => {
                const t = e[c.StyleObjectIdentifier]
                return (0, d.jsx)(
                  'style',
                  {
                    href: `t_${t}`,
                    precedence: 'default',
                    children: e[c.StyleObjectRules].join('\n'),
                  },
                  t
                )
              }),
            })
        }
      },
      1009: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        function i() {
          return !1
        }
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { doesRootSchemeMatchSystem: () => i }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
      },
      1669: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { getThemeProxied: () => h }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))),
          n(1277))
        var u = n(2544),
          c = n(2034)
        ;(n(1009), n(8784))
        const d = new Map()
        let f, p, m
        const b = {}
        function h(e, t, n) {
          if (!t?.theme) return b
          if (((f = n), (p = e), (m = t), d.has(m.theme))) return d.get(m.theme)
          ;(0, u.getConfig)()
          const r = Object.fromEntries(
            Object.entries(t.theme).flatMap(([e, t]) => {
              const n = {
                ...t,
                get val() {
                  return (
                    globalThis.tamaguiAvoidTracking ||
                      (function (e) {
                        f && (f.current || (f.current = new Set()), f.current.add(e))
                      })(e),
                    t.val
                  )
                },
                get(e) {
                  if (!m) return
                  const n = (0, c.getVariable)(t),
                    { name: r, scheme: o, inverses: a } = m
                  return n
                },
              }
              return [
                [e, n],
                [`$${e}`, n],
              ]
            })
          )
          return (d.set(t.theme, r), r)
        }
      },
      102: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { useComponentState: () => b }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(9478),
          d = n(1330),
          f = n(7527),
          p = n(1713),
          m = n(7163)
        n(7522)
        const b = (e, { animationDriver: t }, n, r) => {
            const o = (0, d.useDidFinishSSR)(),
              a = !(0, d.useIsClientOnly)(),
              [l] = (0, f.useState)(a && !o),
              i = t?.useAnimations,
              s = (0, f.useRef)(void 0)
            s.current || (s.current = {})
            const b = !!(
                'animation' in e ||
                (e.style &&
                  ((v = e.style),
                  Object.keys(v).some((e) => {
                    const t = v[e]
                    return t && 'object' == typeof t && '_animation' in t
                  })))
              ),
              g = t?.supportsCSSVars,
              y = s.current
            var v
            !a && b && (y.hasAnimated = !0)
            const S = !!((b && !n.isHOC && i) || y.hasAnimated),
              w = !u.isServer && S
            w && !y.hasAnimated && (y.hasAnimated = !0)
            const { disableClassName: O } = e,
              k = (w && !1 !== e.animatePresence && t?.usePresence?.()) || null,
              x = k?.[2],
              P = !1 === x?.isPresent,
              _ = !0 === x?.isPresent && !1 !== x.initial,
              C = !!e.enterStyle,
              E = b && !o && (t?.isReactNative || !g),
              j = C || _,
              T =
                j || E || O
                  ? j
                    ? p.defaultComponentStateShouldEnter
                    : p.defaultComponentState
                  : p.defaultComponentStateMounted,
              R = h(e)
            null != R && (T.disabled = R)
            const N = (0, f.useState)(T),
              M = e.forceStyle ? { ...N[0], [e.forceStyle]: !0 } : N[0],
              A = N[1]
            let D = w
            ;(u.isWeb && E && !n.isHOC && !o && ((D = !1), (y.willHydrate = !0)),
              R !== M.disabled &&
                (R && Object.assign(M, p.defaultComponentStateMounted),
                (M.disabled = R),
                A((e) => ({ ...M }))))
            const z = e.group,
              I = (0, c.useCreateShallowSetState)(A, e.debug)
            if (x && D && o && n.variants) {
              const { enterVariant: t, exitVariant: r, enterExitVariant: o, custom: a } = x
              ;(0, m.isObj)(a) && Object.assign(e, a)
              const l = r ?? o,
                i = t ?? o
              M.unmounted && i && n.variants[i] ? (e[i] = !0) : P && l && (e[l] = r !== o)
            }
            let $ = !u.isWeb || !!e.forceStyle || (D && t?.needsWebStyles)
            if (u.isWeb && (!u.isServer || o)) {
              const e = D && !g,
                t = !n.acceptsClassName && (r.disableSSR || !M.unmounted),
                o = O && !M.unmounted
              ;(e || o || t) && ($ = !0)
            }
            if (z && !y.group) {
              const e = new Set()
              y.group = {
                listeners: e,
                emit(t, n) {
                  e.forEach((e) => e(t, n))
                },
                subscribe: (t) => (
                  e.add(t),
                  I({ hasDynGroupChildren: !0 }),
                  () => {
                    ;(e.delete(t), 0 === e.size && I({ hasDynGroupChildren: !1 }))
                  }
                ),
              }
            }
            if (!y.stateEmitter && b) {
              const e = new Set()
              y.stateEmitter = {
                listeners: e,
                emit(t) {
                  e.forEach((e) => e(t))
                },
                subscribe: (t) => (
                  e.add(t),
                  I({ hasDynGroupChildren: !0 }),
                  () => {
                    ;(e.delete(t), 0 === e.size && I({ hasDynGroupChildren: !1 }))
                  }
                ),
              }
            }
            return {
              startedUnhydrated: l,
              curStateRef: y,
              disabled: R,
              groupName: z,
              hasAnimationProp: b,
              hasEnterStyle: C,
              isAnimated: D,
              isExiting: P,
              isHydrated: o,
              presence: k,
              presenceState: x,
              setState: A,
              setStateShallow: I,
              noClass: $,
              state: M,
              stateRef: s,
              supportsCSSVars: g,
              willBeAnimated: w,
              willBeAnimatedClient: S,
            }
          },
          h = (e) =>
            e.disabled ||
            e.accessibilityState?.disabled ||
            e['aria-disabled'] ||
            e.accessibilityDisabled ||
            !1
      },
      1544: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { useConfiguration: () => b }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          p = n(2544),
          m = n(5739)
        const b = () => {
          const { groups: e, animationDriver: t, ...n } = f.default.useContext(m.ComponentContext),
            { animations: r, ...o } = (0, p.getConfig)()
          return { ...o, ...n, animationDriver: t ?? (0, p.getConfig)().animations }
        }
      },
      1077: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { useIsTouchDevice: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(1330)
        const d = () => !u.isWeb || (!!(0, c.useDidFinishSSR)() && u.isTouchable)
      },
      3750: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          _disableMediaTouch: () => I,
          configureMedia: () => _,
          getMedia: () => h,
          getMediaImportanceIfMoreImportant: () => L,
          getMediaKeyImportance: () => k,
          getMediaState: () => $,
          isMediaKey: () => v,
          mediaKeyMatch: () => H,
          mediaKeyToQuery: () => B,
          mediaKeys: () => g,
          mediaObjectToString: () => W,
          mediaQueryConfig: () => b,
          mediaState: () => m,
          setMediaShouldUpdate: () => N,
          setupMediaListeners: () => E,
          updateMediaListeners: () => T,
          useMedia: () => A,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(7527),
          d = n(2544),
          f = n(8353),
          p = n(4572)
        let m = {}
        const b = {},
          h = () => m,
          g = new Set(),
          y = /\$(platform|theme|group)-/,
          v = (e) => {
            if (g.has(e)) return !0
            if ('$' === e[0]) {
              const t = e.match(y)
              if (t) return t[1]
            }
            return !1
          }
        let S
        const w = Object.keys(p.pseudoDescriptors).length
        let O
        const k = (e) => ((0, d.getConfig)().settings.mediaPropOrder ? w : O.indexOf(e) + 100),
          x = new Set()
        let P = 0
        const _ = (e) => {
          const { media: t } = e,
            n = (0, d.getSetting)('mediaQueryDefaultActive')
          if (t) {
            P++
            for (const e in t) ((m[e] = n?.[e] || !1), g.add(`$${e}`))
            ;(Object.assign(b, t), (S = { ...m }), (O = Object.keys(t)), E())
          }
        }
        let C = -1
        function E() {
          if (
            !(
              (u.isWeb && u.isServer) ||
              { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.IS_STATIC ||
              C === P
            )
          ) {
            ;((C = P), x.forEach((e) => e()), x.clear())
            for (const e in b) {
              let t = function () {
                const t = !!r().matches
                t !== m[e] && ((m = { ...m, [e]: t }), T())
              }
              const n = W(b[e], e),
                r = () => (0, f.matchMedia)(n),
                o = r()
              if (!o) throw new Error('⚠️ No match')
              ;(o.addListener(t),
                x.add(() => {
                  o.removeListener(t)
                }),
                t())
            }
          }
        }
        const j = new Set()
        function T() {
          j.forEach((e) => e(m))
        }
        const R = new WeakMap()
        function N(e, t, n) {
          const r = R.get(e)
          ;(!r || r.enabled !== t || n) && R.set(e, { ...r, enabled: t, keys: n })
        }
        function M(e) {
          return (
            j.add(e),
            () => {
              j.delete(e)
            }
          )
        }
        function A(e, t) {
          const n = e ? R.get(e) : null,
            r = (0, c.useRef)(null)
          r.current || (r.current = { keys: new Set() })
          const { keys: o, lastState: a = (0, d.getSetting)('disableSSR') ? m : S } = r.current
          o.size && o.clear()
          const l = (0, c.useSyncExternalStore)(
            M,
            () => {
              if (n?.enabled) return ((r.current.lastState = m), m)
              const e = n?.keys || o
              if (!e.size) return a
              for (const t of e) if (m[t] !== a[t]) return ((r.current.lastState = m), m)
              return a
            },
            D
          )
          return new Proxy(l, {
            get: (e, t) => (!z && 'string' == typeof t && o.add(t), Reflect.get(l, t)),
          })
        }
        const D = () => S
        let z = !1
        function I(e) {
          z = e
        }
        function $(e, t) {
          let n
          z = !0
          try {
            n = Object.fromEntries([...e].map((e) => [e, H(e, t)]))
          } finally {
            z = !1
          }
          return n
        }
        const L = (e, t, n, r) => {
            const o = r && !(0, d.getSetting)('mediaPropOrder') ? k(e) : w
            return !n[t] || o > n[t] ? o : null
          },
          F = new WeakMap(),
          V = {}
        function W(e, t) {
          if ('string' == typeof e) return e
          if (F.has(e)) return F.get(e)
          const n = Object.entries(e)
            .map(
              ([e, t]) => (
                (e = e.replace(/[A-Z]/g, (e) => `-${e.toLowerCase()}`).toLowerCase()),
                'string' == typeof t ||
                  ('number' == typeof t && /[height|width]$/.test(e) && (t = `${t}px`)),
                `(${e}: ${t})`
              )
            )
            .join(' and ')
          return (t && (V[t] = n), F.set(e, n), n)
        }
        function B(e) {
          return V[e] || W(b[e], e)
        }
        function H(e, t) {
          const n = b[e]
          return Object.keys(n).every((e) => {
            const r = +n[e],
              o = e.startsWith('max'),
              a = e.endsWith('Width'),
              l = t[a ? 'width' : 'height']
            return o ? l < r : l > r
          })
        }
      },
      9392: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { useProps: () => O, usePropsAndStyle: () => x, useStyle: () => k }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = n(1277),
          p = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          m = n(2544),
          b = n(5739),
          h = n(6638),
          g = n(1597),
          y = n(681),
          v = n(102),
          S = n(3750),
          w = n(5873)
        function O(e, t) {
          const [n, r] = x(e, { ...t, noExpand: !0, noNormalize: !0, resolveValues: 'none' })
          return { ...n, ...r }
        }
        function k(e, t) {
          return x(e, t)[1] || {}
        }
        function x(e, t) {
          const n = t?.forComponent?.staticConfig ?? y.Stack.staticConfig,
            [r, o] = (0, w.useThemeWithState)({
              componentName: n.componentName,
              name: 'theme' in e ? e.theme : void 0,
              inverse: 'themeInverse' in e ? e.themeInverse : void 0,
              needsUpdate: () => !0,
            }),
            a = p.default.useContext(b.ComponentContext),
            {
              state: l,
              disabled: i,
              setStateShallow: s,
            } = (0, v.useComponentState)(e, a, n, (0, m.getConfig)()),
            u = t?.noMedia ? S.mediaState : (0, S.useMedia)(),
            c = (0, h.useSplitStyles)(
              e,
              n,
              r,
              o?.name || '',
              l,
              {
                isAnimated: !1,
                mediaState: u,
                noSkip: !0,
                noMergeStyle: !0,
                noClass: !0,
                resolveValues: 'auto',
                ...t,
              },
              null,
              a
            ),
            { mediaGroups: d, pseudoGroups: O } = c
          return (
            (0, f.useIsomorphicLayoutEffect)(() => {
              if (!i)
                return l.unmounted
                  ? void s({ unmounted: !1 })
                  : (0, g.subscribeToContextGroup)({
                      componentContext: a,
                      setStateShallow: s,
                      state: l,
                      mediaGroups: d,
                      pseudoGroups: O,
                    })
            }, [i, O ? Object.keys([...O]).join('') : 0, d ? Object.keys([...d]).join('') : 0]),
            [c.viewProps, c.style || {}, r, S.mediaState]
          )
        }
      },
      5873: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { useTheme: () => f, useThemeWithState: () => p }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(7527),
          c = n(1669),
          d = n(28)
        const f = (e = {}) => {
            const [t] = p(e)
            return t
          },
          p = (e, t = !1) => {
            const n = (0, u.useRef)(null),
              r = (0, d.useThemeState)(e, t, n)
            return [(0, c.getThemeProxied)(e, r, n), r]
          }
      },
      1408: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { useThemeName: () => f }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(28)
        const c = { forceClassName: !0, deopt: !0, needsUpdate: () => !0 },
          d = { current: new Set(['']) }
        function f() {
          return (0, u.useThemeState)(c, !1, d)?.name || ''
        }
      },
      28: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          ThemeStateContext: () => p,
          forceUpdateThemes: () => O,
          getRootThemeState: () => _,
          getThemeState: () => k,
          hasThemeUpdatingProps: () => N,
          useThemeState: () => C,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(7527),
          d = n(2544),
          f = n(9991)
        const p = (0, c.createContext)(''),
          m = new Map(),
          b = {},
          h = new WeakMap(),
          g = new WeakMap(),
          y = new Map(),
          v = new Map(),
          S = new Map()
        let w = !1
        const O = () => {
            ;((w = !0), m.forEach((e) => e()))
          },
          k = (e) => v.get(e)
        let x = null,
          P = null
        const _ = () => P,
          C = (e, t = !1, n) => {
            const { disable: r } = e,
              o = (0, c.useContext)(p)
            if (!o && !t) throw new Error(f.MISSING_THEME_MESSAGE)
            if (r)
              return (
                v.get(o) || {
                  id: '',
                  name: 'light',
                  theme: (0, d.getConfig)().themes.light,
                  inverses: 0,
                }
              )
            const a = (0, c.useId)(),
              l = (0, c.useCallback)(
                (e) => (
                  (b[o] ||= new Set()),
                  b[o].add(a),
                  m.set(a, () => {
                    ;(y.set(a, !w || 'force'), e())
                  }),
                  () => {
                    ;(m.delete(a), b[o].delete(a), S.delete(a), v.delete(a), y.delete(a))
                  }
                ),
                [a, o]
              ),
              i = R(e),
              s = () => {
                let r = S.get(a)
                const l =
                    !(!t && 'light' !== e.name && 'dark' !== e.name && null !== e.name) ||
                    !h.get(n) ||
                    !!n?.current?.size ||
                    e.needsUpdate?.(),
                  [s, u] = E(r, e, i, t, a, o, l, y.get(a))
                return (
                  y.delete(a),
                  (!r || s) && ((r = { ...u }), S.set(a, r)),
                  Object.assign(r, u),
                  (r.id = a),
                  v.set(a, u),
                  r
                )
              },
              O = (0, c.useSyncExternalStore)(l, s, s)
            return (
              (0, u.useIsomorphicLayoutEffect)(() => {
                if (h.get(n))
                  return i ? (j(a), void g.set(n, !0)) : (g.get(n) && j(a), void g.set(n, !1))
                h.set(n, !0)
              }, [n, i]),
              O
            )
          },
          E = (e, t, n, r = !1, o, a, l, i) => {
            const { debug: s } = t,
              u = v.get(a)
            x || (x = (0, d.getConfig)().themes)
            const c =
                n || (e && e?.isNew)
                  ? (function (
                      e = '',
                      { name: t, reset: n, componentName: r, inverse: o, debug: a },
                      l = !1
                    ) {
                      if (t && n) throw new Error('❌004')
                      const { themes: i } = (0, d.getConfig)()
                      if (n) {
                        const t = e.lastIndexOf('_'),
                          n = t <= 0 ? e : e.slice(t),
                          r = e.slice(0, t)
                        return i[n] ? n : r
                      }
                      const s = e.split('_'),
                        u = s[s.length - 1]
                      u && u[0].toLowerCase() !== u[0] && s.pop()
                      const c = [t && r ? `${t}_${r}` : void 0, t, r].filter(Boolean)
                      let f = null
                      const p = s.length
                      for (let e = 0; e <= p; e++) {
                        const t = (0 === e ? s : s.slice(0, -e)).join('_')
                        for (const e of c) {
                          const n = t ? `${t}_${e}` : e
                          if (n in i) {
                            f = n
                            break
                          }
                        }
                        if (f) break
                      }
                      if (o) {
                        f ||= e
                        const t = f.split('_')[0]
                        f = f.replace(new RegExp(`^${t}`), 'light' === t ? 'dark' : 'light')
                      }
                      return l || f !== e || T[f] ? f : null
                    })(u?.name, t, 'force' === i || !!l)
                  : null,
              p = u && (!c || c === u.name),
              m = !(!l || (!i && e?.name === u?.name))
            if (p) return [m, { ...u, isNew: !1 }]
            if (!c) {
              const t = e ?? u
              if (!t) throw new Error(f.MISSING_THEME_MESSAGE)
              return m ? [!0, { ...(u || e) }] : [!1, t]
            }
            const b = (function (e) {
                return T[e.split('_')[0]]
              })(c),
              h = u?.inverses ?? 0,
              g = u && b !== u.scheme,
              y = h + (g ? 1 : 0),
              S = {
                id: o,
                name: c,
                theme: x[c],
                scheme: b,
                parentId: a,
                parentName: u?.name,
                inverses: y,
                isInverse: g,
                isNew: !0,
              }
            return (
              r && (P = S),
              ('force' !== i && e && e.name === c) ||
              ('force' !== i && e && !l && S.name === e.name)
                ? [!1, S]
                : [!0, S]
            )
          }
        function j(e) {
          const t = [e],
            n = new Set()
          for (; t.length; ) {
            const e = t.shift(),
              r = b[e]
            if (r) for (const e of r) n.has(e) || (n.add(e), t.push(e))
          }
          n.forEach((e) => {
            m.get(e)?.()
          })
        }
        const T = { light: 'light', dark: 'dark' },
          R = ({ name: e, reset: t, inverse: n, forceClassName: r, componentName: o }) =>
            `${e || ''}${n || ''}${t || ''}${r || ''}${o || ''}`,
          N = (e) => 'inverse' in e || 'name' in e || 'reset' in e || 'forceClassName' in e
      },
      9238: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let s of l(t))
                !i.call(e, s) &&
                  s !== n &&
                  o(e, s, { get: () => t[s], enumerable: !(r = a(t, s)) || r.enumerable })
            return e
          },
          u = (e, t, n) => (s(e, t, 'default'), n && s(n, t, 'default')),
          c = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(c, {
          _disableMediaTouch: () => m._disableMediaTouch,
          configureMedia: () => m.configureMedia,
          forceUpdateThemes: () => b.forceUpdateThemes,
          getConfig: () => d.getConfig,
          getMedia: () => m.getMedia,
          getSetting: () => d.getSetting,
          getThemes: () => d.getThemes,
          getToken: () => d.getToken,
          getTokenValue: () => d.getTokenValue,
          getTokens: () => d.getTokens,
          insertStyleRules: () => p.insertStyleRules,
          mediaKeyMatch: () => m.mediaKeyMatch,
          mediaObjectToString: () => m.mediaObjectToString,
          mediaQueryConfig: () => m.mediaQueryConfig,
          mediaState: () => m.mediaState,
          setConfig: () => d.setConfig,
          setNonce: () => f.setNonce,
          setupDev: () => d.setupDev,
          updateConfig: () => d.updateConfig,
          useMedia: () => m.useMedia,
        }),
          (e.exports = ((r = c), s(o({}, '__esModule', { value: !0 }), r))),
          u(c, n(8746), e.exports),
          u(c, n(8715), e.exports),
          u(c, n(1806), e.exports),
          u(c, n(4169), e.exports),
          u(c, n(3774), e.exports),
          u(c, n(4985), e.exports),
          u(c, n(1036), e.exports),
          u(c, n(2034), e.exports),
          u(c, n(5445), e.exports),
          u(c, n(1018), e.exports),
          u(c, n(7975), e.exports),
          u(c, n(1347), e.exports),
          u(c, n(3434), e.exports))
        var d = n(2544),
          f = n(1364)
        ;(u(c, n(9991), e.exports),
          u(c, n(5739), e.exports),
          u(c, n(8243), e.exports),
          u(c, n(5427), e.exports),
          u(c, n(8172), e.exports),
          u(c, n(9478), e.exports))
        var p = n(1364)
        ;(u(c, n(310), e.exports),
          u(c, n(7642), e.exports),
          u(c, n(3383), e.exports),
          u(c, n(6638), e.exports),
          u(c, n(9492), e.exports),
          u(c, n(8715), e.exports),
          u(c, n(7837), e.exports),
          u(c, n(7718), e.exports),
          u(c, n(4577), e.exports),
          u(c, n(2404), e.exports),
          u(c, n(8353), e.exports),
          u(c, n(9194), e.exports),
          u(c, n(3898), e.exports),
          u(c, n(2224), e.exports),
          u(c, n(5687), e.exports),
          u(c, n(3096), e.exports),
          u(c, n(163), e.exports),
          u(c, n(3178), e.exports),
          u(c, n(4572), e.exports),
          u(c, n(3211), e.exports),
          u(c, n(6706), e.exports),
          u(c, n(3691), e.exports),
          u(c, n(6403), e.exports))
        var m = n(3750)
        u(c, n(5873), e.exports)
        var b = n(28)
        ;(u(c, n(1408), e.exports),
          u(c, n(1544), e.exports),
          u(c, n(1077), e.exports),
          u(c, n(9392), e.exports),
          u(c, n(1544), e.exports),
          u(c, n(9399), e.exports),
          u(c, n(681), e.exports),
          u(c, n(6516), e.exports),
          u(c, n(1766), e.exports),
          u(c, n(2778), e.exports),
          u(c, n(4337), e.exports),
          u(c, n(3114), e.exports),
          u(c, n(3970), e.exports),
          u(c, n(8239), e.exports),
          u(c, n(1330), e.exports),
          u(c, n(5946), e.exports),
          u(c, n(6051), e.exports),
          u(c, n(6013), e.exports),
          u(c, n(1277), e.exports),
          u(c, n(6535), e.exports))
      },
      1018: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, {
          insertFont: () => m,
          parseFont: () => h,
          registerFontVariables: () => g,
          updateFont: () => b,
        }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(2544),
          c = n(9991),
          d = n(4985),
          f = n(5445),
          p = n(4392)
        function m(e, t) {
          const n = (0, d.createFont)(t),
            r = (0, f.createVariables)(n, e),
            o = h(r)
          if (typeof document < 'u') {
            const t = g(o),
              n =
                document.querySelector(`style[${c.FONT_DATA_ATTRIBUTE_NAME}="${e}"]`) ||
                document.createElement('style')
            ;((n.innerText = `:root .font_${e} {${t.join(';')}}`),
              n.setAttribute(c.FONT_DATA_ATTRIBUTE_NAME, e),
              document.head.appendChild(n))
          }
          return ((0, u.setConfigFont)(e, r, o), o)
        }
        const b = m
        function h(e) {
          const t = {}
          for (const n in e) {
            const r = e[n]
            if ('family' === n || 'face' === n) t[n] = r
            else {
              t[n] = {}
              for (const e in r) {
                let o = r[e]
                ;('$' === o.val?.[0] && (o = o.val), (t[n][`$${e}`] = o))
              }
            }
          }
          return t
        }
        function g(e) {
          const t = []
          for (const n in e)
            if ('face' !== n)
              if ('family' === n) {
                const r = e[n]
                ;((0, p.registerCSSVariable)(r), t.push((0, p.variableToCSS)(r)))
              } else
                for (const r in e[n])
                  if ('string' != typeof e[n][r]) {
                    const o = e[n][r]
                    ;((0, p.registerCSSVariable)(o), t.push((0, p.variableToCSS)(o)))
                  }
          return t
        }
      },
      3434: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty
        e.exports =
          ((t = {}),
          ((e, t, l, i) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let l of o(t))
                !a.call(e, l) &&
                  undefined !== l &&
                  n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
            return e
          })(n({}, '__esModule', { value: !0 }), t))
      },
      6535: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { hooks: () => i, setupHooks: () => s }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = {}
        function s(e) {
          Object.assign(i, e)
        }
      },
      1347: (e) => {
        var t,
          n = Object.defineProperty,
          r = Object.getOwnPropertyDescriptor,
          o = Object.getOwnPropertyNames,
          a = Object.prototype.hasOwnProperty,
          l = {}
        ;(((e, t) => {
          for (var r in t) n(e, r, { get: t[r], enumerable: !0 })
        })(l, { getReactNativeConfig: () => s, setupReactNative: () => c }),
          (e.exports =
            ((t = l),
            ((e, t, l, i) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let l of o(t))
                  !a.call(e, l) &&
                    undefined !== l &&
                    n(e, l, { get: () => t[l], enumerable: !(i = r(t, l)) || i.enumerable })
              return e
            })(n({}, '__esModule', { value: !0 }), t))))
        const i = new WeakMap()
        function s(e) {
          if (e)
            return e.getSize && e.prefetch
              ? u.Image
              : 'Text' === e.displayName && e.render
                ? u.Text
                : !e.render || ('ScrollView' !== e.displayName && 'View' !== e.displayName)
                  ? e.State?.blurTextInput
                    ? u.TextInput
                    : i.get(e)
                  : u.default
        }
        const u = {
          Image: { isReactNative: !0, inlineProps: new Set(['src', 'width', 'height']) },
          Text: { isReactNative: !0, isText: !0 },
          TextInput: { isReactNative: !0, isInput: !0, isText: !0 },
          default: { isReactNative: !0 },
        }
        function c(e) {}
      },
      7975: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { styled: () => f }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(8715),
          c = n(2682),
          d = n(1347)
        function f(e, t, n) {
          const r = e.staticConfig,
            o = !!r && !(r.isReactNative || r.isHOC)
          let a = (r?.isHOC && !r?.isStyledHOC) || o ? e : r?.Component || e
          const l = r ? void 0 : (0, d.getReactNativeConfig)(a),
            i = !!(l || n?.isReactNative || r?.isReactNative),
            s = (() => {
              let e,
                s,
                {
                  variants: u,
                  name: d,
                  defaultVariants: f,
                  acceptsClassName: p,
                  context: m,
                  ...b
                } = t || {}
              if (r && (!r.isHOC || r.isStyledHOC)) {
                const t = r.defaultProps
                for (const n in t) {
                  const o = t[n]
                  ;(r.defaultVariants &&
                    n in r.defaultVariants &&
                    (!f || !(n in f)) &&
                    ((e ||= {}), (e[n] = o)),
                    !(n in b) && (!f || !(n in f)) && ((s ||= {}), (s[n] = t[n])))
                }
                r.variants && (u = (0, c.mergeVariants)(r.variants, u))
              }
              ;((s || f || e) && (b = { ...s, ...e, ...b, ...f }),
                r?.isHOC && d && (b.componentName = d))
              const h = !(!n?.isText && !r?.isText),
                g = n?.acceptsClassName ?? p ?? (o || i || (r?.isHOC && r?.acceptsClassName)),
                y = {
                  ...r,
                  ...n,
                  ...(!o && { Component: a }),
                  variants: u,
                  defaultProps: b,
                  defaultVariants: f,
                  componentName: d || r?.componentName,
                  isReactNative: i,
                  isText: h,
                  acceptsClassName: g,
                  context: m,
                  ...l,
                  isStyledHOC: !!r?.isHOC,
                  parentStaticConfig: r,
                }
              return ((b.children || !g || m) && (y.neverFlatten = !0), y)
            })(),
            f = (0, u.createComponent)(s || {})
          for (const t in e) 'propTypes' !== t && (t in f || (f[t] = e[t]))
          return f
        }
      },
      8239: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { Configuration: () => h }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = n(1330),
          p = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          m = n(5739),
          b = n(2351)
        const h = (e) => {
          const t = p.default.useContext(m.ComponentContext),
            n = (0, p.useContext)(f.ClientOnlyContext),
            r = (0, b.jsx)(m.ComponentContext.Provider, { ...t, ...e })
          return n ? (0, b.jsx)(f.ClientOnly, { children: r }) : r
        }
        h.displayName = 'Configuration'
      },
      3114: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { FontLanguage: () => c }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(2351)
        const c = ({ children: e, ...t }) =>
          (0, u.jsx)('div', {
            style: { display: 'contents' },
            className: Object.entries(t)
              .map(([e, t]) => `t_lang-${e}-${t}`)
              .join(' '),
            children: e,
          })
        c.displayName = 'FontLanguage'
      },
      9399: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { Slot: () => b, Slottable: () => h }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(6051),
          c = n(1277),
          d = n(6013),
          f = n(7527),
          p = n(2351)
        const m = f.version.startsWith('19.'),
          b = (0, f.memo)(
            (0, f.forwardRef)(function (e, t) {
              const { children: n, ...r } = e
              if ((0, f.isValidElement)(n)) {
                const e = (function (e, t) {
                  const n = e.props,
                    r = { ...n },
                    o = 'string' == typeof e.type
                  if (o) for (const e in g) e in t && ((t[g[e]] = t[e]), delete t[e])
                  for (let e in n) {
                    const a = t[e],
                      l = n[e]
                    ;(o && e in g && ((e = g[e]), delete r[e]),
                      y.test(e)
                        ? (r[e] = (0, d.composeEventHandlers)(l, a))
                        : 'style' === e
                          ? (r[e] = { ...a, ...l })
                          : 'className' === e && (r[e] = [a, l].filter(Boolean).join(' ')))
                  }
                  return { ...t, ...r }
                })(n, r)
                return (0, f.cloneElement)(
                  n,
                  n.type.avoidForwardRef
                    ? e
                    : { ...e, ref: (0, u.composeRefs)(t, m ? n.props.ref : n.ref) }
                )
              }
              return f.Children.count(n) > 1 ? f.Children.only(null) : null
            })
          ),
          h = ({ children: e }) => (0, p.jsx)(p.Fragment, { children: e })
        h.displayName = 'Slottable'
        const g = c.isWeb
            ? { onPress: 'onClick', onPressOut: 'onMouseUp', onPressIn: 'onMouseDown' }
            : {},
          y = /^on[A-Z]/
      },
      681: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { Stack: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(6013),
          c = n(9991)
        const d = (0, n(8715).createComponent)({
          acceptsClassName: !0,
          defaultProps: c.stackDefaultStyles,
          validStyles: u.validStyles,
        })
        d.displayName = 'Stack'
      },
      3970: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { TamaguiProvider: () => S }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = n(1277),
          p = n(1330),
          m = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          b = n(2544),
          h = n(5739),
          g = n(3750),
          y = n(4337),
          v = n(2351)
        function S({
          children: e,
          disableInjectCSS: t,
          config: n,
          className: r,
          defaultTheme: o,
          disableRootThemeClass: a,
          reset: l,
          themeClassNameOnRoot: i,
        }) {
          ;(f.IS_REACT_19 ||
            (f.isClient &&
              (0, f.useIsomorphicLayoutEffect)(() => {
                if (n && !t) {
                  const e = document.createElement('style')
                  return (
                    e.appendChild(document.createTextNode(n.getCSS())),
                    document.head.appendChild(e),
                    () => {
                      document.head.removeChild(e)
                    }
                  )
                }
              }, [n, t])),
            (0, f.useIsomorphicLayoutEffect)(() => {
              ;(0, g.updateMediaListeners)()
            }, []))
          let s = (0, v.jsx)(w, {
            children: (0, v.jsx)(h.ComponentContext.Provider, {
              animationDriver: n?.animations,
              children: (0, v.jsx)(y.ThemeProvider, {
                themeClassNameOnRoot: i ?? (0, b.getSetting)('themeClassNameOnRoot'),
                disableRootThemeClass: a ?? (0, b.getSetting)('disableRootThemeClass'),
                defaultTheme: o ?? (n ? Object.keys(n.themes)[0] : ''),
                reset: l,
                className: r,
                children: e,
              }),
            }),
          })
          return (
            (0, b.getSetting)('disableSSR') && (s = (0, v.jsx)(p.ClientOnly, { children: s })),
            (0, v.jsxs)(v.Fragment, {
              children: [
                s,
                f.IS_REACT_19 &&
                  n &&
                  !t &&
                  (0, v.jsx)(
                    'style',
                    { precedence: 'default', href: 'tamagui-css', children: n.getCSS() },
                    'tamagui-css'
                  ),
              ],
            })
          )
        }
        function w(e) {
          const [t, n] = m.default.useState(!1)
          return (
            m.default.useEffect(() => {
              n(!0)
            }, []),
            f.isWeb
              ? (0, v.jsx)('span', {
                  style: { display: 'contents' },
                  className: t ? '' : 't_unmounted',
                  children: e.children,
                })
              : e.children
          )
        }
        S.displayName = 'TamaguiProvider'
      },
      1766: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { Text: () => f }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(6013)
        const c = {
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
          d = c,
          f = (0, n(8715).createComponent)({
            acceptsClassName: !0,
            isText: !0,
            defaultProps: {
              fontFamily: 'unset',
              display: 'inline',
              boxSizing: 'border-box',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              margin: 0,
            },
            inlineWhenUnflattened: new Set(['fontFamily']),
            variants: {
              numberOfLines: {
                1: c,
                ':number': (e) =>
                  e >= 1
                    ? {
                        WebkitLineClamp: e,
                        WebkitBoxOrient: 'vertical',
                        display: '-webkit-box',
                        overflow: 'hidden',
                      }
                    : null,
              },
              selectable: {
                true: { userSelect: 'text', cursor: 'text' },
                false: { userSelect: 'none', cursor: 'default' },
              },
              ellipse: { true: d },
              ellipsis: { true: d },
            },
            validStyles: { ...u.validStyles, ...u.stylePropsTextOnly },
          })
        f.displayName = 'Text'
      },
      2778: (e, t, n) => {
        var r,
          o = Object.create,
          a = Object.defineProperty,
          l = Object.getOwnPropertyDescriptor,
          i = Object.getOwnPropertyNames,
          s = Object.getPrototypeOf,
          u = Object.prototype.hasOwnProperty,
          c = (e, t, n, r) => {
            if ((t && 'object' == typeof t) || 'function' == typeof t)
              for (let o of i(t))
                !u.call(e, o) &&
                  o !== n &&
                  a(e, o, { get: () => t[o], enumerable: !(r = l(t, o)) || r.enumerable })
            return e
          },
          d = {}
        ;(((e, t) => {
          for (var n in t) a(e, n, { get: t[n], enumerable: !0 })
        })(d, { Theme: () => S, getThemedChildren: () => w }),
          (e.exports = ((r = d), c(a({}, '__esModule', { value: !0 }), r))))
        var f = n(1277),
          p = ((e, t, n) => (
            (n = null != e ? o(s(e)) : {}),
            c(e && e.__esModule ? n : a(n, 'default', { value: e, enumerable: !0 }), e)
          ))(n(7527)),
          m = n(2544),
          b = n(2034),
          h = n(5873),
          g = n(28),
          y = (n(9811), n(2351))
        const v = { className: '', style: {} },
          S = (0, p.forwardRef)(function (e, t) {
            if (e.disable) return e.children
            const n = !!e._isRoot,
              [r, o] = (0, h.useThemeWithState)(e, n)
            let a = e['disable-child-theme']
              ? p.Children.map(e.children, (e) =>
                  (0, p.cloneElement)(e, { 'data-disable-theme': !0 })
                )
              : e.children
            if (t)
              try {
                ;(p.default.Children.only(a), (a = (0, p.cloneElement)(a, { ref: t })))
              } catch {}
            return w(o, a, e, n, (0, p.useRef)({ hasEverThemed: !1 }))
          })
        function w(e, t, n, r = !1, o) {
          const { shallow: a, forceClassName: l } = n,
            i = o.current
          if (!(i.hasEverThemed || e.isNew || r || (0, g.hasThemeUpdatingProps)(n))) return t
          t = (0, y.jsx)(g.ThemeStateContext.Provider, { value: e.id, children: t })
          const { isInverse: s, name: u } = e,
            c = s || l
          if (
            (i.hasEverThemed || (i.hasEverThemed = !0),
            (c || 'dark' === e.name || 'light' === e.name) && (i.hasEverThemed = 'wrapped'),
            a && e.parentId)
          ) {
            const n = (0, g.getThemeState)(e.isNew ? e.id : e.parentId)
            if (!n) throw new Error('‼️010')
            t = p.Children.toArray(t).map((e) =>
              (0, p.isValidElement)(e)
                ? (0, p.cloneElement)(
                    e,
                    void 0,
                    (0, y.jsx)(S, { name: n.name, children: e.props.children })
                  )
                : e
            )
          }
          if (!1 === l) return t
          if (f.isWeb) {
            const { className: o, style: a } = (function (e, t, n = !1) {
              if (!e.isNew && !t.forceClassName) return v
              const r = e?.theme && e.isNew ? (0, b.variableToString)(e.theme.color) : '',
                o = r ? { color: r } : void 0,
                a = (0, m.getSetting)('maxDarkLightNesting') || 3
              return {
                style: o,
                className: `${n ? '' : 't_sub_theme'} t_${e.inverses >= a ? e.name : e.name.replace(O, '')}`,
              }
            })(e, n, r)
            if (
              ((t = (0, y.jsx)('span', {
                className: `${o} _dsp_contents is_Theme`,
                style: a,
                children: t,
              })),
              'wrapped' === i.hasEverThemed)
            ) {
              const e = c
                ? (s
                    ? u.startsWith('light')
                      ? 't_light is_inversed'
                      : u.startsWith('dark')
                        ? 't_dark is_inversed'
                        : ''
                    : '') + ' _dsp_contents'
                : '_dsp_contents'
              t = (0, y.jsx)('span', { className: e, children: t })
            }
            return t
          }
          return t
        }
        S.avoidForwardRef = !0
        const O = /^(dark|light)_/
      },
      9811: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        function u({ themeState: e, themeProps: t, children: n }) {
          return n
        }
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { ThemeDebug: () => u }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))),
          n(1330),
          n(7527),
          n(7970),
          n(28),
          n(2351),
          (u.displayName = 'ThemeDebug'))
      },
      4337: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { ThemeProvider: () => b }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(1277),
          c = n(7527),
          d = n(2544),
          f = n(9991),
          p = n(2778),
          m = n(2351)
        const b = (e) => {
          const t = e.disableRootThemeClass ?? (0, d.getSetting)('disableRootThemeClass'),
            n = e.themeClassNameOnRoot ?? (0, d.getSetting)('themeClassNameOnRoot')
          return (
            u.isClient &&
              (0, u.useIsomorphicLayoutEffect)(() => {
                if (t) return
                const r = `${f.THEME_CLASSNAME_PREFIX}${e.defaultTheme}`,
                  o = n ? document.documentElement : document.body
                return (
                  o.classList.add(r),
                  () => {
                    o.classList.remove(r)
                  }
                )
              }, [e.defaultTheme, t, n]),
            (0, m.jsx)(p.Theme, {
              className: e.className,
              name: e.defaultTheme,
              forceClassName: !t && !n,
              _isRoot: c.useId,
              children: e.children,
            })
          )
        }
      },
      6516: (e, t, n) => {
        var r,
          o = Object.defineProperty,
          a = Object.getOwnPropertyDescriptor,
          l = Object.getOwnPropertyNames,
          i = Object.prototype.hasOwnProperty,
          s = {}
        ;(((e, t) => {
          for (var n in t) o(e, n, { get: t[n], enumerable: !0 })
        })(s, { View: () => d }),
          (e.exports =
            ((r = s),
            ((e, t, n, r) => {
              if ((t && 'object' == typeof t) || 'function' == typeof t)
                for (let n of l(t))
                  !i.call(e, n) &&
                    undefined !== n &&
                    o(e, n, { get: () => t[n], enumerable: !(r = a(t, n)) || r.enumerable })
              return e
            })(o({}, '__esModule', { value: !0 }), r))))
        var u = n(6013),
          c = n(9991)
        const d = (0, n(8715).createComponent)({
          acceptsClassName: !0,
          defaultProps: c.stackDefaultStyles,
          validStyles: u.validStyles,
        })
      },
    },
    t = {}
  function n(r) {
    var o = t[r]
    if (void 0 !== o) return o.exports
    var a = (t[r] = { exports: {} })
    return (e[r](a, a.exports, n), a.exports)
  }
  ;((n.n = (e) => {
    var t = e && e.__esModule ? () => e.default : () => e
    return (n.d(t, { a: t }), t)
  }),
    (n.d = (e, t) => {
      for (var r in t)
        n.o(t, r) && !n.o(e, r) && Object.defineProperty(e, r, { enumerable: !0, get: t[r] })
    }),
    (n.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)),
    (n.r = (e) => {
      ;('undefined' != typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
        Object.defineProperty(e, '__esModule', { value: !0 }))
    }),
    (() => {
      'use strict'
      var e = n(2351),
        t = n(4107),
        r = n(4641),
        o = (n(7260), n(7527))
      o.use
      const a = typeof window < 'u',
        l = !a,
        i = a,
        s = l ? o.useEffect : o.useLayoutEffect,
        u =
          (typeof navigator < 'u' && /Chrome/.test(navigator.userAgent || ''),
          i && ('ontouchstart' in window || navigator.maxTouchPoints),
          (e, t) => {
            if (!e) return
            const { tokens: n } = t,
              o = n.size[e],
              a = (0, r.isVariable)(o) ? +o.val : e
            return c(a, t)
          }),
        c = (e, { theme: t, tokens: n }) => {
          let o = 0
          if (!0 === e) {
            const e = (0, r.getVariableValue)(n.size.true)
            o = 'number' == typeof e ? e : 10
          } else o = +e
          if (0 === o) return
          const [a, l] = [Math.round(o / 4 + 1), Math.round(o / 2 + 2)]
          return {
            shadowColor: t.shadowColor,
            shadowRadius: l,
            shadowOffset: { height: a, width: 0 },
            ...(r.isAndroid ? { elevationAndroid: 2 * a } : {}),
          }
        },
        d = {
          fullscreen: { true: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } },
          elevation: { '...size': u, ':number': u },
          inset: (e) => (e && 'object' == typeof e ? e : { top: e, left: e, bottom: e, right: e }),
        },
        f = (0, r.styled)(r.View, { flexDirection: 'column', variants: d })
      ;((f.displayName = 'YStack'),
        ((0, r.styled)(r.View, { flexDirection: 'row', variants: d }).displayName = 'XStack'),
        ((0, r.styled)(
          f,
          { position: 'relative' },
          { neverFlatten: !0, isZStack: !0 }
        ).displayName = 'ZStack'))
      const p = (0, o.createContext)(1),
        m = (0, o.createContext)(void 0),
        b = {},
        h = {}
      var g = n(7970),
        y = n(9238)
      const v = (e) =>
          typeof e > 'u' || 'unset' === e
            ? void 0
            : 'number' == typeof e
              ? e
              : (0, y.getTokenValue)(e, 'zIndex'),
        S =
          (o.memo((t) => {
            if (l) return null
            const { host: n = globalThis.document?.body, stackZIndex: r, children: a, ...i } = t,
              s = ((e) => {
                if (
                  { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_STACK_Z_INDEX_GLOBAL
                ) {
                  const { stackZIndex: t, zIndex: n } = e,
                    r = (0, o.useId)(),
                    a = (0, o.useMemo)(() => {
                      if (t && 'global' !== t && void 0 === n) {
                        const e = Object.values(h).reduce((e, t) => Math.max(e, t), 0)
                        return Math.max(!0 === t ? 1 : t, e + 1)
                      }
                      return n ?? 1e3
                    }, [t])
                  return (
                    (0, o.useEffect)(() => {
                      if ('number' == typeof t)
                        return (
                          (h[r] = t),
                          () => {
                            delete h[r]
                          }
                        )
                    }, [t]),
                    a
                  )
                }
                {
                  const { stackZIndex: t, zIndex: n } = e,
                    r = (0, o.useId)(),
                    a = (0, o.useContext)(p),
                    l = 'global' === t ? 0 : a,
                    i = (0, o.useContext)(m)
                  b[l] ||= {}
                  const s = b[l],
                    u = (0, o.useMemo)(() => {
                      if ('number' == typeof n) return n
                      if (t) {
                        if (i) return i + 1
                        const e = Object.values(s).reduce((e, t) => Math.max(e, t), 0),
                          n = 5e3 * l + e + 1
                        return 'number' == typeof t ? t + n : n
                      }
                      return 1
                    }, [l, n, t])
                  return (
                    (0, o.useEffect)(() => {
                      if (t)
                        return (
                          (s[r] = u),
                          () => {
                            delete s[r]
                          }
                        )
                    }, [u]),
                    u
                  )
                }
              })(((e) => ({ stackZIndex: e.stackZIndex, zIndex: v(e.zIndex) }))(t))
            return (0, g.createPortal)(
              (0, e.jsx)(f, {
                contain: 'strict',
                fullscreen: !0,
                position: 'fixed',
                maxWidth: '100vw',
                maxHeight: '100vh',
                pointerEvents: 'none',
                ...i,
                zIndex: s,
                children: a,
              }),
              n
            )
          }),
          typeof global < 'u' && (global._IS_FABRIC ?? global.nativeFabricUIManager),
          new Map()),
        w = {},
        O = {},
        k = (e, t) => (t in e || (e[t] = []), e),
        x = (e, t) => {
          const { type: n } = t
          switch (n) {
            case 0:
              return k({ ...e }, t.hostName)
            case 1:
              return ((e, t) => (delete e[t], e))({ ...e }, t.hostName)
            case 2:
              return ((e, t, n, r) => {
                t in e || (e = k(e, t))
                const o = e[t].findIndex((e) => e.name === n)
                return (-1 !== o ? (e[t][o].node = r) : e[t].push({ name: n, node: r }), e)
              })({ ...e }, t.hostName, t.portalName, t.node)
            case 3:
              return ((e, t, n) => {
                if (!(t in e))
                  return (
                    console.info(`Failed to remove portal '${n}', '${t}' was not registered!`),
                    e
                  )
                const r = e[t].findIndex((e) => e.name === n)
                return (-1 !== r && e[t].splice(r, 1), e)
              })({ ...e }, t.hostName, t.portalName)
            default:
              return e
          }
        },
        P = (0, o.createContext)(null),
        _ = (0, o.createContext)(null),
        C = (0, o.memo)(({ rootHostName: t = 'root', shouldAddRootHost: n = !0, children: r }) => {
          const [a, l] = (0, o.useReducer)(x, O),
            i = (0, o.useMemo)(
              () => (e) => {
                var t
                ;((t = () => {
                  l(e)
                }),
                  (0, o.startTransition)(t))
              },
              [l]
            )
          return (0, e.jsx)(_.Provider, {
            value: i,
            children: (0, e.jsxs)(P.Provider, {
              value: a,
              children: [r, n && (0, e.jsx)(E, { name: t })],
            }),
          })
        })
      C.displayName = 'PortalProvider'
      const E = (0, o.memo)(function (t) {
        return (0, e.jsx)(j, { ...t })
      })
      function j(t) {
        return (
          (0, o.useEffect)(
            () => () => {
              S.delete(t.name)
            },
            [t.name]
          ),
          (0, e.jsx)('div', {
            style: { display: 'contents' },
            ref: (e) => {
              e && (S.set(t.name, e), w[t.name]?.forEach((t) => t(e)))
            },
          })
        )
      }
      const T = ({ children: t, ...n }) =>
          (0, e.jsx)(r.TamaguiProvider, {
            ...n,
            children: (0, e.jsx)(p.Provider, {
              value: 1,
              children: (0, e.jsx)(C, { shouldAddRootHost: !0, children: t }),
            }),
          }),
        R = (e, t) => {
          const n = N(e, t)
          return (0, r.isVariable)(n) ? +n.val : n ? +n : 16
        },
        N = (e, t) => {
          const n = M(e, t)
          if (!n) return e
          const o = (0, r.getConfig)()
          return o.fontsParsed[t?.font || o.defaultFontToken]?.size[n]
        },
        M = (e, t) => {
          if ('number' == typeof e) return null
          const n = t?.relativeSize || 0,
            o = (0, r.getConfig)(),
            a = o.fontsParsed[t?.font || o.defaultFontToken]?.size || o.tokensParsed.size,
            l = ('$true' !== e || '$true' in a ? e : '$4') ?? ('$true' in a ? '$true' : '$4'),
            i = Object.keys(a)
          let s = i.indexOf(l)
          return (
            -1 === s && l.endsWith('.5') && (s = i.indexOf(l.replace('.5', ''))),
            i[Math.min(Math.max(0, s + n), i.length - 1)] ?? l
          )
        },
        A = { shift: 0, bounds: [0] },
        D = {},
        z = {},
        I = {},
        $ = {},
        L = (e, { tokens: t, props: n }) => {
          if (!e || n.circular) return
          if ('number' == typeof e)
            return {
              paddingHorizontal: 0.25 * e,
              height: e,
              borderRadius: n.circular ? 1e5 : 0.2 * e,
            }
          const r = ((e, t, n = A) => {
              const r = (0, y.getTokens)({ prefixed: !0 })[e]
              if (!(e in D)) {
                ;((I[e] = []), (D[e] = []), ($[e] = []), (z[e] = []))
                const t = Object.keys(r)
                  .map((e) => r[e])
                  .sort((e, t) => e.val - t.val)
                for (const n of t) (I[e].push(n.key), D[e].push(n))
                const n = t.filter((e) => !e.key.endsWith('.5'))
                for (const t of n) ($[e].push(t.key), z[e].push(t))
              }
              const o = 'string' == typeof t,
                a = (n.excludeHalfSteps ? (o ? $ : z) : o ? I : D)[e],
                l = n.bounds?.[0] ?? 0,
                i = n.bounds?.[1] ?? a.length - 1,
                s = a.indexOf(t)
              let u = n.shift || 0
              u &&
                ('$true' === t || ((0, y.isVariable)(t) && 'true' === t.name)) &&
                (u += u > 0 ? 1 : -1)
              const c = a[Math.min(i, Math.max(l, s + u))]
              return ('string' == typeof c ? r[c] : c) || r.$true
            })('space', e, void 0),
            o = t.radius[e] ?? t.radius.$true
          return { paddingHorizontal: r, height: e, borderRadius: n.circular ? 1e5 : o }
        },
        F = { color: !0, textDecorationColor: !0, textShadowColor: !0 },
        V = {
          borderRadius: !0,
          borderTopLeftRadius: !0,
          borderTopRightRadius: !0,
          borderBottomLeftRadius: !0,
          borderBottomRightRadius: !0,
          borderStartStartRadius: !0,
          borderStartEndRadius: !0,
          borderEndStartRadius: !0,
          borderEndEndRadius: !0,
        },
        W = Symbol(),
        B = (e) => {
          const t = ((e) => {
            const t = (0, y.useTheme)()
            return e ? (0, y.getVariable)(e) : t[e]?.get() || t.color?.get()
          })(e.color)
          return (n) =>
            n &&
            (o.isValidElement(n)
              ? o.cloneElement(n, { ...e, color: t, ...n.props })
              : o.createElement(n, e))
        },
        H = { borderRadius: 1e5, padding: 0 },
        U = {
          true: (e, { props: t, tokens: n }) => {
            if (!('size' in t)) return H
            const r = 'number' == typeof t.size ? t.size : n.size[t.size]
            return {
              ...H,
              width: r,
              height: r,
              maxWidth: r,
              maxHeight: r,
              minWidth: r,
              minHeight: r,
            }
          },
        },
        G = {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          shadowColor: 'transparent',
          hoverStyle: { borderColor: 'transparent' },
        },
        q = {
          backgrounded: { true: { backgroundColor: '$background' } },
          radiused: {
            true: (e, t) => {
              const { tokens: n, props: r } = t
              return { borderRadius: n.radius[r.size] || n.radius.$true }
            },
          },
          hoverTheme: {
            true: {
              hoverStyle: { backgroundColor: '$backgroundHover', borderColor: '$borderColorHover' },
            },
            false: {},
          },
          pressTheme: {
            true: {
              cursor: 'pointer',
              pressStyle: { backgroundColor: '$backgroundPress', borderColor: '$borderColorPress' },
            },
            false: {},
          },
          focusTheme: {
            true: {
              focusStyle: { backgroundColor: '$backgroundFocus', borderColor: '$borderColorFocus' },
            },
            false: {},
          },
          circular: U,
          padded: {
            true: (e, t) => {
              const { tokens: n, props: r } = t
              return { padding: n.space[r.size] || n.space.$true }
            },
          },
          elevate: { true: (e, t) => u(t.props.size, t) },
          bordered: (e, { props: t }) => ({
            borderWidth: 'number' == typeof e ? e : 1,
            borderColor: '$borderColor',
            ...(t.hoverTheme && { hoverStyle: { borderColor: '$borderColorHover' } }),
            ...(t.pressTheme && { pressStyle: { borderColor: '$borderColorPress' } }),
            ...(t.focusTheme && { focusStyle: { borderColor: '$borderColorFocus' } }),
          }),
          transparent: { true: { backgroundColor: 'transparent' } },
          chromeless: { true: G, all: { ...G, hoverStyle: G, pressStyle: G, focusStyle: G } },
        },
        X = (0, r.styled)(f, { variants: q }),
        Y = o.createContext(!1),
        K = (e = '$true', { font: t, fontFamily: n, props: r }) => {
          if (!t) return { fontSize: e }
          const o =
              '$true' === e
                ? (function (e) {
                    if ('object' == typeof e && Q.has(e)) return Q.get(e)
                    const t = '$true' in e.size ? e.size : (0, y.getTokens)().size,
                      n = t.$true,
                      r = n ? Object.keys(t).find((e) => '$true' !== e && t[e].val === n.val) : null
                    return n && r ? (Q.set(e, r), r) : Object.keys(e.size)[3]
                  })(t)
                : e,
            a = {},
            l = t.size[o],
            i = t.lineHeight?.[o],
            s = t.weight?.[o],
            u = t.letterSpacing?.[o],
            c = t.transform?.[o],
            d = r.fontStyle ?? t.style?.[o],
            f = r.color ?? t.color?.[o]
          return (
            d && (a.fontStyle = d),
            c && (a.textTransform = c),
            n && (a.fontFamily = n),
            s && (a.fontWeight = s),
            u && (a.letterSpacing = u),
            l && (a.fontSize = l),
            i && (a.lineHeight = i),
            f && (a.color = f),
            a
          )
        },
        Q =
          ((0, y.styled)(y.Text, {
            name: 'SizableText',
            fontFamily: '$body',
            variants: { size: { '...fontSize': K } },
            defaultVariants: { size: '$true' },
          }),
          new WeakMap()),
        Z = (0, y.styled)(y.Text, {
          name: 'SizableText',
          fontFamily: '$body',
          variants: { unstyled: { false: { size: '$true', color: '$color' } }, size: K },
          defaultVariants: {
            unstyled: '1' === { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_HEADLESS,
          },
        })
      Z.staticConfig.variants.fontFamily = {
        '...': (e, t) => {
          const n = t.props.size,
            r = t.props.fontSize,
            o = '$true' === n && r ? r : t.props.size || '$true'
          return K(o, t)
        },
      }
      const J = (0, y.createStyledContext)({
          color: void 0,
          ellipse: void 0,
          fontFamily: void 0,
          fontSize: void 0,
          fontStyle: void 0,
          fontWeight: void 0,
          letterSpacing: void 0,
          maxFontSizeMultiplier: void 0,
          size: void 0,
          textAlign: void 0,
          variant: void 0,
        }),
        ee = (0, y.styled)(X, {
          name: 'Button',
          tag: 'button',
          context: J,
          role: 'button',
          focusable: !0,
          variants: {
            unstyled: {
              false: {
                size: '$true',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'nowrap',
                flexDirection: 'row',
                cursor: 'pointer',
                hoverTheme: !0,
                pressTheme: !0,
                backgrounded: !0,
                borderWidth: 1,
                borderColor: 'transparent',
                focusVisibleStyle: {
                  outlineColor: '$outlineColor',
                  outlineStyle: 'solid',
                  outlineWidth: 2,
                },
              },
            },
            variant: {
              outlined: {
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderColor: '$borderColor',
                hoverStyle: { backgroundColor: 'transparent', borderColor: '$borderColorHover' },
                pressStyle: { backgroundColor: 'transparent', borderColor: '$borderColorPress' },
                focusVisibleStyle: {
                  backgroundColor: 'transparent',
                  borderColor: '$borderColorFocus',
                },
              },
            },
            size: { '...size': L, ':number': L },
            disabled: { true: { pointerEvents: 'none' } },
          },
          defaultVariants: {
            unstyled: '1' === { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_HEADLESS,
          },
        }),
        te = (0, y.styled)(Z, {
          name: 'Button',
          context: J,
          variants: {
            unstyled: {
              false: {
                userSelect: 'none',
                cursor: 'pointer',
                flexGrow: 0,
                flexShrink: 1,
                ellipse: !0,
                color: '$color',
              },
            },
          },
          defaultVariants: {
            unstyled: '1' === { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_HEADLESS,
          },
        }),
        ne = ee.styleable(function (t, n) {
          const { props: r } = (function (
            { textProps: t, ...n },
            { Text: r = re.Text } = { Text: re.Text }
          ) {
            const a = (0, o.useContext)(Y),
              l = (0, y.useProps)(n, { noNormalize: !0, noExpand: !0 }),
              {
                icon: i,
                iconAfter: s,
                space: u,
                spaceFlex: c,
                scaleIcon: d = 1,
                scaleSpace: f = 0.66,
                separator: p,
                noTextWrap: m,
                fontFamily: b,
                fontSize: h,
                fontWeight: g,
                fontStyle: v,
                letterSpacing: S,
                tag: w,
                ellipse: O,
                maxFontSizeMultiplier: k,
                ...x
              } = l,
              P = l.size || (l.unstyled ? void 0 : '$true'),
              _ = l.color,
              C =
                ('number' == typeof P ? 0.5 * P : R(P, { font: '$' === b?.[0] ? b : void 0 })) * d,
              E = B({ size: C, color: _ }),
              [j, T] = [i, s].map(E),
              N = u ?? (0, y.getVariableValue)(C) * f,
              M = m
                ? [n.children]
                : (function (t, n, r) {
                    const {
                      children: a,
                      textProps: l,
                      size: i,
                      noTextWrap: s,
                      color: u,
                      fontFamily: c,
                      fontSize: d,
                      fontWeight: f,
                      letterSpacing: p,
                      textAlign: m,
                      fontStyle: b,
                      maxFontSizeMultiplier: h,
                    } = n
                    if (s || !a) return [a]
                    const g = { ...r }
                    return (
                      u && (g.color = u),
                      c && (g.fontFamily = c),
                      d && (g.fontSize = d),
                      f && (g.fontWeight = f),
                      p && (g.letterSpacing = p),
                      m && (g.textAlign = m),
                      i && (g.size = i),
                      b && (g.fontStyle = b),
                      h && (g.maxFontSizeMultiplier = h),
                      o.Children.toArray(a).map((n, r) =>
                        'string' == typeof n ? (0, e.jsx)(t, { ...g, ...l, children: n }, r) : n
                      )
                    )
                  })(
                    r,
                    {
                      children: n.children,
                      fontFamily: b,
                      fontSize: h,
                      textProps: t,
                      fontWeight: g,
                      fontStyle: v,
                      letterSpacing: S,
                      ellipse: O,
                      maxFontSizeMultiplier: k,
                    },
                    r === te && !0 !== l.unstyled
                      ? {
                          unstyled:
                            '1' ===
                            { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_HEADLESS,
                          size: P,
                        }
                      : void 0
                  ),
              A = (0, y.spacedChildren)({
                space: !1 === N ? 0 : 1 == N ? '$true' : N,
                spaceFlex: c,
                ensureKeys: !0,
                separator: p,
                direction:
                  'column' === l.flexDirection || 'column-reverse' === l.flexDirection
                    ? 'vertical'
                    : 'horizontal',
                children: [j, ...M, T],
              })
            return {
              spaceSize: N,
              isNested: a,
              props: {
                size: P,
                ...(n.disabled && {
                  focusable: void 0,
                  focusVisibleStyle: { borderColor: '$background' },
                }),
                tag:
                  w ??
                  (a
                    ? 'span'
                    : 'link' === l.accessibilityRole || 'link' === l.role
                      ? 'a'
                      : 'button'),
                ...x,
                children: (0, e.jsx)(Y.Provider, { value: !0, children: A }),
                disableClassName: !0,
              },
            }
          })(t)
          return (0, e.jsx)(ee, { 'data-disable-theme': !0, ...r, ref: n })
        }),
        re = ((e, t) => {
          const n = (() => {
            if (e[W]) {
              const t = o.forwardRef((t, n) => o.createElement(e, { ...t, ref: n }))
              for (const n in e) {
                const r = e[n]
                t[n] = r && 'object' == typeof r ? { ...r } : r
              }
            }
            return e
          })()
          return (Object.assign(n, t), (n[W] = !0), n)
        })(ne, {
          Text: te,
          Icon: (e) => {
            const { children: t, scaleIcon: n = 1 } = e,
              { size: r, color: a } = (0, o.useContext)(J),
              l = ('number' == typeof r ? 0.5 * r : R(r)) * n
            return B({ size: l, color: a })(t)
          },
        })
      function oe(e, t) {
        if (null == e) return {}
        var n,
          r,
          o = {},
          a = Object.keys(e)
        for (r = 0; r < a.length; r++) ((n = a[r]), t.indexOf(n) >= 0 || (o[n] = e[n]))
        return o
      }
      var ae = {
        adjustable: 'slider',
        button: 'button',
        header: 'heading',
        image: 'img',
        imagebutton: null,
        keyboardkey: null,
        label: null,
        link: 'link',
        none: 'presentation',
        search: 'search',
        summary: 'region',
        text: null,
      }
      const le = (e) => {
        var t = e.accessibilityRole,
          n = e.role || t
        if (n) {
          var r = ae[n]
          if (null !== r) return r || n
        }
      }
      var ie = {
          article: 'article',
          banner: 'header',
          blockquote: 'blockquote',
          button: 'button',
          code: 'code',
          complementary: 'aside',
          contentinfo: 'footer',
          deletion: 'del',
          emphasis: 'em',
          figure: 'figure',
          insertion: 'ins',
          form: 'form',
          list: 'ul',
          listitem: 'li',
          main: 'main',
          navigation: 'nav',
          paragraph: 'p',
          region: 'section',
          strong: 'strong',
        },
        se = {}
      const ue = function (e) {
          if ((void 0 === e && (e = se), 'label' === (e.role || e.accessibilityRole)))
            return 'label'
          var t = le(e)
          if (t) {
            if ('heading' === t) {
              var n = e.accessibilityLevel || e['aria-level']
              return null != n ? 'h' + n : 'h1'
            }
            return ie[t]
          }
        },
        ce = le
      function de(e) {
        return (de =
          'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
            ? function (e) {
                return typeof e
              }
            : function (e) {
                return e &&
                  'function' == typeof Symbol &&
                  e.constructor === Symbol &&
                  e !== Symbol.prototype
                  ? 'symbol'
                  : typeof e
              })(e)
      }
      function fe(e, t, n) {
        return (
          (t = (function (e) {
            var t = (function (e, t) {
              if ('object' !== de(e) || null === e) return e
              var n = e[Symbol.toPrimitive]
              if (void 0 !== n) {
                var r = n.call(e, 'string')
                if ('object' !== de(r)) return r
                throw new TypeError('@@toPrimitive must return a primitive value.')
              }
              return String(e)
            })(e)
            return 'symbol' === de(t) ? t : String(t)
          })(t)) in e
            ? Object.defineProperty(e, t, {
                value: n,
                enumerable: !0,
                configurable: !0,
                writable: !0,
              })
            : (e[t] = n),
          e
        )
      }
      function pe(e, t) {
        var n = Object.keys(e)
        if (Object.getOwnPropertySymbols) {
          var r = Object.getOwnPropertySymbols(e)
          ;(t &&
            (r = r.filter(function (t) {
              return Object.getOwnPropertyDescriptor(e, t).enumerable
            })),
            n.push.apply(n, r))
        }
        return n
      }
      function me(e) {
        for (var t = 1; t < arguments.length; t++) {
          var n = null != arguments[t] ? arguments[t] : {}
          t % 2
            ? pe(Object(n), !0).forEach(function (t) {
                fe(e, t, n[t])
              })
            : Object.getOwnPropertyDescriptors
              ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n))
              : pe(Object(n)).forEach(function (t) {
                  Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t))
                })
        }
        return e
      }
      var be = {
          animationIterationCount: !0,
          aspectRatio: !0,
          borderImageOutset: !0,
          borderImageSlice: !0,
          borderImageWidth: !0,
          boxFlex: !0,
          boxFlexGroup: !0,
          boxOrdinalGroup: !0,
          columnCount: !0,
          flex: !0,
          flexGrow: !0,
          flexOrder: !0,
          flexPositive: !0,
          flexShrink: !0,
          flexNegative: !0,
          fontWeight: !0,
          gridRow: !0,
          gridRowEnd: !0,
          gridRowGap: !0,
          gridRowStart: !0,
          gridColumn: !0,
          gridColumnEnd: !0,
          gridColumnGap: !0,
          gridColumnStart: !0,
          lineClamp: !0,
          opacity: !0,
          order: !0,
          orphans: !0,
          tabSize: !0,
          widows: !0,
          zIndex: !0,
          zoom: !0,
          fillOpacity: !0,
          floodOpacity: !0,
          stopOpacity: !0,
          strokeDasharray: !0,
          strokeDashoffset: !0,
          strokeMiterlimit: !0,
          strokeOpacity: !0,
          strokeWidth: !0,
          scale: !0,
          scaleX: !0,
          scaleY: !0,
          scaleZ: !0,
          shadowOpacity: !0,
        },
        he = ['ms', 'Moz', 'O', 'Webkit']
      Object.keys(be).forEach((e) => {
        he.forEach((t) => {
          be[((e, t) => e + t.charAt(0).toUpperCase() + t.substring(1))(t, e)] = be[e]
        })
      })
      const ge = be
      var ye = n(4612),
        ve = n.n(ye)
      const Se = function (e, t) {
        if ((void 0 === t && (t = 1), null != e)) {
          if (
            'string' == typeof e &&
            ((e) =>
              'currentcolor' === e ||
              'currentColor' === e ||
              'inherit' === e ||
              0 === e.indexOf('var('))(e)
          )
            return e
          var n = ((e) => {
            if (null == e) return e
            var t = ve()(e)
            return null != t ? (t = ((t << 24) | (t >>> 8)) >>> 0) : void 0
          })(e)
          if (null != n)
            return (
              'rgba(' +
              ((n >> 16) & 255) +
              ',' +
              ((n >> 8) & 255) +
              ',' +
              (255 & n) +
              ',' +
              ((((n >> 24) & 255) / 255) * t).toFixed(2) +
              ')'
            )
        }
      }
      var we = {
        backgroundColor: !0,
        borderColor: !0,
        borderTopColor: !0,
        borderRightColor: !0,
        borderBottomColor: !0,
        borderLeftColor: !0,
        color: !0,
        shadowColor: !0,
        textDecorationColor: !0,
        textShadowColor: !0,
      }
      function Oe(e, t) {
        var n = e
        return (
          (null != t && ge[t]) || 'number' != typeof e
            ? null != t && we[t] && (n = Se(e))
            : (n = e + 'px'),
          n
        )
      }
      const ke = !(
        'undefined' == typeof window ||
        !window.document ||
        !window.document.createElement
      )
      var xe = {},
        Pe =
          !ke ||
          (null != window.CSS &&
            null != window.CSS.supports &&
            (window.CSS.supports('text-decoration-line', 'none') ||
              window.CSS.supports('-webkit-text-decoration-line', 'none'))),
        _e = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
        Ce = {
          borderColor: [
            'borderTopColor',
            'borderRightColor',
            'borderBottomColor',
            'borderLeftColor',
          ],
          borderBlockColor: ['borderTopColor', 'borderBottomColor'],
          borderInlineColor: ['borderRightColor', 'borderLeftColor'],
          borderRadius: [
            'borderTopLeftRadius',
            'borderTopRightRadius',
            'borderBottomRightRadius',
            'borderBottomLeftRadius',
          ],
          borderStyle: [
            'borderTopStyle',
            'borderRightStyle',
            'borderBottomStyle',
            'borderLeftStyle',
          ],
          borderBlockStyle: ['borderTopStyle', 'borderBottomStyle'],
          borderInlineStyle: ['borderRightStyle', 'borderLeftStyle'],
          borderWidth: [
            'borderTopWidth',
            'borderRightWidth',
            'borderBottomWidth',
            'borderLeftWidth',
          ],
          borderBlockWidth: ['borderTopWidth', 'borderBottomWidth'],
          borderInlineWidth: ['borderRightWidth', 'borderLeftWidth'],
          insetBlock: ['top', 'bottom'],
          insetInline: ['left', 'right'],
          marginBlock: ['marginTop', 'marginBottom'],
          marginInline: ['marginRight', 'marginLeft'],
          paddingBlock: ['paddingTop', 'paddingBottom'],
          paddingInline: ['paddingRight', 'paddingLeft'],
          overflow: ['overflowX', 'overflowY'],
          overscrollBehavior: ['overscrollBehaviorX', 'overscrollBehaviorY'],
          borderBlockStartColor: ['borderTopColor'],
          borderBlockStartStyle: ['borderTopStyle'],
          borderBlockStartWidth: ['borderTopWidth'],
          borderBlockEndColor: ['borderBottomColor'],
          borderBlockEndStyle: ['borderBottomStyle'],
          borderBlockEndWidth: ['borderBottomWidth'],
          borderEndStartRadius: ['borderBottomLeftRadius'],
          borderEndEndRadius: ['borderBottomRightRadius'],
          borderStartStartRadius: ['borderTopLeftRadius'],
          borderStartEndRadius: ['borderTopRightRadius'],
          insetBlockEnd: ['bottom'],
          insetBlockStart: ['top'],
          marginBlockStart: ['marginTop'],
          marginBlockEnd: ['marginBottom'],
          paddingBlockStart: ['paddingTop'],
          paddingBlockEnd: ['paddingBottom'],
        }
      const Ee = (e, t) => {
          if (!e) return xe
          var n = {},
            r = function () {
              var r = e[o]
              if (null == r) return 'continue'
              if ('backgroundClip' === o)
                'text' === r && ((n.backgroundClip = r), (n.WebkitBackgroundClip = r))
              else if ('flex' === o)
                -1 === r
                  ? ((n.flexGrow = 0), (n.flexShrink = 1), (n.flexBasis = 'auto'))
                  : (n.flex = r)
              else if ('font' === o) n[o] = r.replace('System', _e)
              else if ('fontFamily' === o)
                if (r.indexOf('System') > -1) {
                  var a = r.split(/,\s*/)
                  ;((a[a.indexOf('System')] = _e), (n[o] = a.join(',')))
                } else n[o] = 'monospace' === r ? 'monospace,monospace' : r
              else if ('textDecorationLine' === o)
                Pe ? (n.textDecorationLine = r) : (n.textDecoration = r)
              else if ('writingDirection' === o) n.direction = r
              else {
                var l = Oe(e[o], o),
                  i = Ce[o]
                t && 'inset' === o
                  ? (null == e.insetInline && ((n.left = l), (n.right = l)),
                    null == e.insetBlock && ((n.top = l), (n.bottom = l)))
                  : t && 'margin' === o
                    ? (null == e.marginInline && ((n.marginLeft = l), (n.marginRight = l)),
                      null == e.marginBlock && ((n.marginTop = l), (n.marginBottom = l)))
                    : t && 'padding' === o
                      ? (null == e.paddingInline && ((n.paddingLeft = l), (n.paddingRight = l)),
                        null == e.paddingBlock && ((n.paddingTop = l), (n.paddingBottom = l)))
                      : i
                        ? i.forEach((t, r) => {
                            null == e[t] && (n[t] = l)
                          })
                        : (n[o] = l)
              }
            }
          for (var o in e) r()
          return n
        },
        je = (e) =>
          (function (e, t) {
            for (var n, r = e.length, o = 1 ^ r, a = 0; r >= 4; )
              ((n =
                1540483477 *
                  (65535 &
                    (n =
                      (255 & e.charCodeAt(a)) |
                      ((255 & e.charCodeAt(++a)) << 8) |
                      ((255 & e.charCodeAt(++a)) << 16) |
                      ((255 & e.charCodeAt(++a)) << 24))) +
                (((1540483477 * (n >>> 16)) & 65535) << 16)),
                (o =
                  (1540483477 * (65535 & o) + (((1540483477 * (o >>> 16)) & 65535) << 16)) ^
                  (n =
                    1540483477 * (65535 & (n ^= n >>> 24)) +
                    (((1540483477 * (n >>> 16)) & 65535) << 16))),
                (r -= 4),
                ++a)
            switch (r) {
              case 3:
                o ^= (255 & e.charCodeAt(a + 2)) << 16
              case 2:
                o ^= (255 & e.charCodeAt(a + 1)) << 8
              case 1:
                o =
                  1540483477 * (65535 & (o ^= 255 & e.charCodeAt(a))) +
                  (((1540483477 * (o >>> 16)) & 65535) << 16)
            }
            return (
              (o =
                1540483477 * (65535 & (o ^= o >>> 13)) +
                (((1540483477 * (o >>> 16)) & 65535) << 16)),
              (o ^= o >>> 15) >>> 0
            )
          })(e).toString(36)
      var Te = /[A-Z]/g,
        Re = /^ms-/,
        Ne = {}
      function Me(e) {
        return '-' + e.toLowerCase()
      }
      const Ae = function (e) {
        if (e in Ne) return Ne[e]
        var t = e.replace(Te, Me)
        return (Ne[e] = Re.test(t) ? '-' + t : t)
      }
      var De = n(8628),
        ze = n(9582),
        Ie = n(7829),
        $e = n(3507),
        Le = n(9629),
        Fe = n(6908),
        Ve = n(349),
        We = ['Webkit'],
        Be = ['Webkit', 'ms']
      const He = {
          plugins: [ze.A, Ie.A, $e.A, Le.A, Fe.A, Ve.A],
          prefixMap: {
            appearance: ['Webkit', 'Moz', 'ms'],
            userSelect: ['Webkit', 'Moz'],
            textEmphasisPosition: Be,
            textEmphasis: Be,
            textEmphasisStyle: Be,
            textEmphasisColor: Be,
            boxDecorationBreak: Be,
            clipPath: We,
            maskImage: Be,
            maskMode: Be,
            maskRepeat: Be,
            maskPosition: Be,
            maskClip: Be,
            maskOrigin: Be,
            maskSize: Be,
            maskComposite: Be,
            mask: Be,
            maskBorderSource: Be,
            maskBorderMode: Be,
            maskBorderSlice: Be,
            maskBorderWidth: Be,
            maskBorderOutset: Be,
            maskBorderRepeat: Be,
            maskBorder: Be,
            maskType: Be,
            textDecorationStyle: We,
            textDecorationSkip: We,
            textDecorationLine: We,
            textDecorationColor: We,
            filter: We,
            breakAfter: We,
            breakBefore: We,
            breakInside: We,
            columnCount: We,
            columnFill: We,
            columnGap: We,
            columnRule: We,
            columnRuleColor: We,
            columnRuleStyle: We,
            columnRuleWidth: We,
            columns: We,
            columnSpan: We,
            columnWidth: We,
            backdropFilter: We,
            hyphens: We,
            flowInto: We,
            flowFrom: We,
            regionFragment: We,
            textOrientation: We,
            tabSize: ['Moz'],
            fontKerning: We,
            textSizeAdjust: We,
          },
        },
        Ue = (0, De.A)(He)
      var Ge = ['animationKeyframes'],
        qe = new Map(),
        Xe = {},
        Ye = 1,
        Ke = 3,
        Qe = {
          borderColor: 2,
          borderRadius: 2,
          borderStyle: 2,
          borderWidth: 2,
          display: 2,
          flex: 2,
          inset: 2,
          margin: 2,
          overflow: 2,
          overscrollBehavior: 2,
          padding: 2,
          insetBlock: 2.1,
          insetInline: 2.1,
          marginInline: 2.1,
          marginBlock: 2.1,
          paddingInline: 2.1,
          paddingBlock: 2.1,
          borderBlockStartColor: 2.2,
          borderBlockStartStyle: 2.2,
          borderBlockStartWidth: 2.2,
          borderBlockEndColor: 2.2,
          borderBlockEndStyle: 2.2,
          borderBlockEndWidth: 2.2,
          borderInlineStartColor: 2.2,
          borderInlineStartStyle: 2.2,
          borderInlineStartWidth: 2.2,
          borderInlineEndColor: 2.2,
          borderInlineEndStyle: 2.2,
          borderInlineEndWidth: 2.2,
          borderEndStartRadius: 2.2,
          borderEndEndRadius: 2.2,
          borderStartStartRadius: 2.2,
          borderStartEndRadius: 2.2,
          insetBlockEnd: 2.2,
          insetBlockStart: 2.2,
          insetInlineEnd: 2.2,
          insetInlineStart: 2.2,
          marginBlockStart: 2.2,
          marginBlockEnd: 2.2,
          marginInlineStart: 2.2,
          marginInlineEnd: 2.2,
          paddingBlockStart: 2.2,
          paddingBlockEnd: 2.2,
          paddingInlineStart: 2.2,
          paddingInlineEnd: 2.2,
        },
        Ze = 'borderTopLeftRadius',
        Je = 'borderTopRightRadius',
        et = 'borderBottomLeftRadius',
        tt = 'borderBottomRightRadius',
        nt = 'borderLeftColor',
        rt = 'borderLeftStyle',
        ot = 'borderLeftWidth',
        at = 'borderRightColor',
        lt = 'borderRightStyle',
        it = 'borderRightWidth',
        st = 'right',
        ut = 'marginLeft',
        ct = 'marginRight',
        dt = 'paddingLeft',
        ft = 'paddingRight',
        pt = 'left',
        mt = {
          [Ze]: Je,
          [Je]: Ze,
          [et]: tt,
          [tt]: et,
          [nt]: at,
          [rt]: lt,
          [ot]: it,
          [at]: nt,
          [lt]: rt,
          [it]: ot,
          [pt]: st,
          [ut]: ct,
          [ct]: ut,
          [dt]: ft,
          [ft]: dt,
          [st]: pt,
        },
        bt = {
          borderStartStartRadius: Ze,
          borderStartEndRadius: Je,
          borderEndStartRadius: et,
          borderEndEndRadius: tt,
          borderInlineStartColor: nt,
          borderInlineStartStyle: rt,
          borderInlineStartWidth: ot,
          borderInlineEndColor: at,
          borderInlineEndStyle: lt,
          borderInlineEndWidth: it,
          insetInlineEnd: st,
          insetInlineStart: pt,
          marginInlineStart: ut,
          marginInlineEnd: ct,
          paddingInlineStart: dt,
          paddingInlineEnd: ft,
        },
        ht = ['clear', 'float', 'textAlign']
      function gt(e) {
        var t = Ue(Ee(e))
        return (
          '{' +
          Object.keys(t)
            .map((e) => {
              var n = t[e],
                r = Ae(e)
              return Array.isArray(n) ? n.map((e) => r + ':' + e).join(';') : r + ':' + n
            })
            .sort()
            .join(';') +
          ';}'
        )
      }
      function yt(e, t, n) {
        return e + '-' + je(t + n)
      }
      function vt(e) {
        if ('number' == typeof e) throw new Error('Invalid CSS keyframes type: ' + typeof e)
        var t = [],
          n = []
        return (
          (Array.isArray(e) ? e : [e]).forEach((e) => {
            if ('string' == typeof e) t.push(e)
            else {
              var r = (function (e) {
                  var t = yt('r', 'animation', JSON.stringify(e)),
                    n =
                      '{' +
                      Object.keys(e)
                        .map((t) => '' + t + gt(e[t]))
                        .join('') +
                      '}',
                    r = ['-webkit-', ''].map((e) => '@' + e + 'keyframes ' + t + n)
                  return [t, r]
                })(e),
                o = r[0],
                a = r[1]
              ;(t.push(o), n.push(...a))
            }
          }),
          [t, n]
        )
      }
      function St(e, t, n) {
        if (ke) {
          var r = null != t ? t : document,
            o = r.getElementById(e)
          if (null == o)
            if (
              ((o = document.createElement('style')).setAttribute('id', e),
              'string' == typeof n && o.appendChild(document.createTextNode(n)),
              r instanceof ShadowRoot)
            )
              r.insertBefore(o, r.firstChild)
            else {
              var a = r.head
              a && a.insertBefore(o, a.firstChild)
            }
          return o.sheet
        }
        return null
      }
      var wt = Array.prototype.slice
      function Ot(e) {
        var t,
          n = {},
          r = {}
        function o(e, t, r) {
          var o = xt(n),
            a = o.indexOf(t) + 1,
            l = o[a],
            i = null != l && null != n[l].start ? n[l].start : e.cssRules.length,
            s = (function (e, t, n) {
              try {
                return (e.insertRule(t, n), !0)
              } catch (e) {
                return !1
              }
            })(e, r, i)
          if (s) {
            null == n[t].start && (n[t].start = i)
            for (var u = a; u < o.length; u += 1) {
              var c = o[u],
                d = n[c].start || 0
              n[c].start = d + 1
            }
          }
          return s
        }
        null != e &&
          wt.call(e.cssRules).forEach((e, o) => {
            var a = e.cssText
            if (a.indexOf('stylesheet-group') > -1)
              ((t = (function (e) {
                return Number(e.selectorText.split(kt)[1])
              })(e)),
                (n[t] = { start: o, rules: [a] }))
            else {
              var l = _t(a)
              null != l && ((r[l] = !0), n[t].rules.push(a))
            }
          })
        var a = {
          getTextContent: () =>
            xt(n)
              .map((e) => {
                var t = n[e].rules,
                  r = t.shift()
                return (t.sort(), t.unshift(r), t.join('\n'))
              })
              .join('\n'),
          insert(t, a) {
            var l = Number(a)
            if (null == n[l]) {
              var i = (function (e) {
                return '[stylesheet-group="' + e + '"]{}'
              })(l)
              ;((n[l] = { start: null, rules: [i] }), null != e && o(e, l, i))
            }
            var s = _t(t)
            null != s &&
              null == r[s] &&
              ((r[s] = !0), n[l].rules.push(t), null != e && (o(e, l, t) || n[l].rules.pop()))
          },
        }
        return a
      }
      var kt = /["']/g
      function xt(e) {
        return Object.keys(e)
          .map(Number)
          .sort((e, t) => (e > t ? 1 : -1))
      }
      var Pt = /\s*([,])\s*/g
      function _t(e) {
        var t = e.split('{')[0].trim()
        return '' !== t ? t.replace(Pt, '$1') : null
      }
      var Ct = new WeakMap(),
        Et = [],
        jt = [
          'html{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0);}',
          'body{margin:0;}',
          'button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}',
          'input::-webkit-search-cancel-button,input::-webkit-search-decoration,input::-webkit-search-results-button,input::-webkit-search-results-decoration{display:none;}',
        ],
        Tt = n(9121)
      var Rt = {},
        Nt = { height: 0, width: 0 },
        Mt = (e) => {
          if ('string' == typeof e) return e
          var t = Oe(e.offsetX) || 0,
            n = Oe(e.offsetY) || 0,
            r = Oe(e.blurRadius) || 0,
            o = Oe(e.spreadDistance) || 0,
            a = Se(e.color) || 'black'
          return (e.inset ? 'inset ' : '') + t + ' ' + n + ' ' + r + ' ' + o + ' ' + a
        },
        At = (e) => e.map(Mt).join(', '),
        Dt = (e) => {
          var t = Object.keys(e)[0],
            n = e[t]
          return 'matrix' === t || 'matrix3d' === t
            ? t + '(' + n.join(',') + ')'
            : t + '(' + Oe(n, t) + ')'
        },
        zt = (e) => e.map(Dt).join(' '),
        It = (e) => e.map((e) => Oe(e)).join(' '),
        $t = {
          borderBottomEndRadius: 'borderEndEndRadius',
          borderBottomStartRadius: 'borderEndStartRadius',
          borderTopEndRadius: 'borderStartEndRadius',
          borderTopStartRadius: 'borderStartStartRadius',
          borderEndColor: 'borderInlineEndColor',
          borderEndStyle: 'borderInlineEndStyle',
          borderEndWidth: 'borderInlineEndWidth',
          borderStartColor: 'borderInlineStartColor',
          borderStartStyle: 'borderInlineStartStyle',
          borderStartWidth: 'borderInlineStartWidth',
          end: 'insetInlineEnd',
          marginEnd: 'marginInlineEnd',
          marginHorizontal: 'marginInline',
          marginStart: 'marginInlineStart',
          marginVertical: 'marginBlock',
          paddingEnd: 'paddingInlineEnd',
          paddingHorizontal: 'paddingInline',
          paddingStart: 'paddingInlineStart',
          paddingVertical: 'paddingBlock',
          start: 'insetInlineStart',
        },
        Lt = { elevation: !0, overlayColor: !0, resizeMode: !0, tintColor: !0 },
        Ft = function (e, t) {
          void 0 === t && (t = {})
          var n = e || Rt,
            r = {}
          if (
            (t.shadow,
            null != n.shadowColor ||
              null != n.shadowOffset ||
              null != n.shadowOpacity ||
              null != n.shadowRadius)
          ) {
            var o = ((e) => {
              var t = e.shadowColor,
                n = e.shadowOffset,
                r = e.shadowOpacity,
                o = e.shadowRadius,
                a = n || Nt,
                l = a.height,
                i = Oe(a.width),
                s = Oe(l),
                u = Oe(o || 0),
                c = Se(t || 'black', r)
              if (null != c && null != i && null != s && null != u)
                return i + ' ' + s + ' ' + u + ' ' + c
            })(n)
            null != o && (r.boxShadow = o)
          }
          if (
            (t.textShadow,
            null != n.textShadowColor || null != n.textShadowOffset || null != n.textShadowRadius)
          ) {
            var a = ((e) => {
              var t = e.textShadowColor,
                n = e.textShadowOffset,
                r = e.textShadowRadius,
                o = n || Nt,
                a = o.height,
                l = o.width,
                i = r || 0,
                s = Oe(l),
                u = Oe(a),
                c = Oe(i),
                d = Oe(t, 'textShadowColor')
              if (d && (0 !== a || 0 !== l || 0 !== i) && null != s && null != u && null != c)
                return s + ' ' + u + ' ' + c + ' ' + d
            })(n)
            if (null != a && null == r.textShadow) {
              var l = n.textShadow,
                i = l ? l + ', ' + a : a
              r.textShadow = i
            }
          }
          for (var s in n)
            if (
              null == Lt[s] &&
              'shadowColor' !== s &&
              'shadowOffset' !== s &&
              'shadowOpacity' !== s &&
              'shadowRadius' !== s &&
              'textShadowColor' !== s &&
              'textShadowOffset' !== s &&
              'textShadowRadius' !== s
            ) {
              var u = n[s],
                c = $t[s] || s,
                d = u
              if (Object.prototype.hasOwnProperty.call(n, s) && (c === s || null == n[c]))
                if ('aspectRatio' === c && 'number' == typeof d) r[c] = d.toString()
                else if ('boxShadow' === c) {
                  Array.isArray(d) && (d = At(d))
                  var f = r.boxShadow
                  r.boxShadow = f ? d + ', ' + f : d
                } else
                  'fontVariant' === c
                    ? (Array.isArray(d) && d.length > 0 && (d = d.join(' ')), (r[c] = d))
                    : 'textAlignVertical' === c
                      ? null == n.verticalAlign && (r.verticalAlign = 'center' === d ? 'middle' : d)
                      : 'transform' === c
                        ? (Array.isArray(d) && (d = zt(d)), (r.transform = d))
                        : 'transformOrigin' === c
                          ? (Array.isArray(d) && (d = It(d)), (r.transformOrigin = d))
                          : (r[c] = d)
            }
          return r
        },
        Vt = n(1613),
        Wt = ['writingDirection'],
        Bt = new WeakMap(),
        Ht = (function (e, t) {
          var n
          if ((void 0 === t && (t = 'react-native-stylesheet'), ke)) {
            var r = document
            if (0 === Et.length)
              ((n = Ot(St(t))),
                jt.forEach((e) => {
                  n.insert(e, 0)
                }),
                Ct.set(r, Et.length),
                Et.push(n))
            else {
              var o = Ct.get(r)
              if (null == o) {
                var a = Et[0],
                  l = null != a ? a.getTextContent() : ''
                ;((n = Ot(St(t, r, l))), Ct.set(r, Et.length), Et.push(n))
              } else n = Et[o]
            }
          } else
            0 === Et.length
              ? ((n = Ot(St(t))),
                jt.forEach((e) => {
                  n.insert(e, 0)
                }),
                Et.push(n))
              : (n = Et[0])
          return {
            getTextContent: () => n.getTextContent(),
            id: t,
            insert(e, t) {
              Et.forEach((n) => {
                n.insert(e, t)
              })
            },
          }
        })(),
        Ut = { shadow: !0, textShadow: !0 }
      function Gt(e) {
        e.forEach((e) => {
          var t = e[0],
            n = e[1]
          null != Ht &&
            t.forEach((e) => {
              Ht.insert(e, n)
            })
        })
      }
      var qt = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
        Xt = Yt({ x: me({}, qt) }).x
      function Yt(e) {
        return (
          Object.keys(e).forEach((t) => {
            var n,
              r,
              o,
              a = e[t]
            null != a &&
              !0 !== a.$$css &&
              (t.indexOf('$raw') > -1
                ? (n = (function (e, t) {
                    var n = (function (e, t) {
                        var n,
                          r = { $$css: !0 },
                          o = [],
                          a = e.animationKeyframes,
                          l = oe(e, Ge),
                          i = yt('css', t, JSON.stringify(e)),
                          s = '.' + i
                        if (null != a) {
                          var u = vt(a),
                            c = u[0],
                            d = u[1]
                          ;((n = c.join(',')), o.push(...d))
                        }
                        var f = gt(me(me({}, l), {}, { animationName: n }))
                        return (o.push('' + s + f), (r[i] = i), [r, [[o, Ye]]])
                      })(e, t),
                      r = n[0]
                    return (Gt(n[1]), r)
                  })(a, t.split('$raw')[0]))
                : ((r = (function (e) {
                    var t = { $$css: !0 },
                      n = []
                    function r(e, t, r) {
                      var o,
                        a = (function (e, t) {
                          var n = Oe(e, t)
                          return 'string' != typeof n ? JSON.stringify(n || '') : n
                        })(r, t),
                        l = t + a,
                        i = qe.get(l)
                      if (null != i) ((o = i[0]), n.push(i[1]))
                      else {
                        o = yt('r', e, e !== t ? l : a)
                        var s = Qe[e] || Ke,
                          u = (function (e, t, n) {
                            var r = [],
                              o = '.' + e
                            switch (t) {
                              case 'animationKeyframes':
                                var a = vt(n),
                                  l = a[0],
                                  i = a[1],
                                  s = gt({ animationName: l.join(',') })
                                r.push('' + o + s, ...i)
                                break
                              case 'placeholderTextColor':
                                var u = gt({ color: n, opacity: 1 })
                                r.push(
                                  o + '::-webkit-input-placeholder' + u,
                                  o + '::-moz-placeholder' + u,
                                  o + ':-ms-input-placeholder' + u,
                                  o + '::placeholder' + u
                                )
                                break
                              case 'pointerEvents':
                                var c = n
                                if ('auto' === n || 'box-only' === n) {
                                  if (((c = 'auto!important'), 'box-only' === n)) {
                                    var d = gt({ pointerEvents: 'none' })
                                    r.push(o + '>*' + d)
                                  }
                                } else if (
                                  ('none' === n || 'box-none' === n) &&
                                  ((c = 'none!important'), 'box-none' === n)
                                ) {
                                  var f = gt({ pointerEvents: 'auto' })
                                  r.push(o + '>*' + f)
                                }
                                var p = gt({ pointerEvents: c })
                                r.push('' + o + p)
                                break
                              case 'scrollbarWidth':
                                'none' === n && r.push(o + '::-webkit-scrollbar{display:none}')
                                var m = gt({ scrollbarWidth: n })
                                r.push('' + o + m)
                                break
                              default:
                                var b = gt({ [t]: n })
                                r.push('' + o + b)
                            }
                            return r
                          })(o, t, r),
                          c = [u, s]
                        ;(n.push(c), qe.set(l, [o, c]))
                      }
                      return o
                    }
                    return (
                      Object.keys(e)
                        .sort()
                        .forEach((n) => {
                          var o = e[n]
                          if (null != o) {
                            var a
                            if (ht.indexOf(n) > -1) {
                              var l = r(n, n, 'left'),
                                i = r(n, n, 'right')
                              'start' === o ? (a = [l, i]) : 'end' === o && (a = [i, l])
                            }
                            var s = bt[n]
                            if (null != s) {
                              var u = r(n, s, o),
                                c = r(n, mt[s], o)
                              a = [u, c]
                            }
                            if ('transitionProperty' === n) {
                              for (
                                var d = Array.isArray(o) ? o : [o], f = [], p = 0;
                                p < d.length;
                                p++
                              ) {
                                var m = d[p]
                                'string' == typeof m && null != bt[m] && f.push(p)
                              }
                              if (f.length > 0) {
                                var b = [...d],
                                  h = [...d]
                                f.forEach((e) => {
                                  var t = b[e]
                                  if ('string' == typeof t) {
                                    var o = bt[t],
                                      l = mt[o]
                                    ;((b[e] = o), (h[e] = l))
                                    var i = r(n, n, b),
                                      s = r(n, n, h)
                                    a = [i, s]
                                  }
                                })
                              }
                            }
                            ;(null == a ? (a = r(n, n, o)) : (t.$$css$localize = !0), (t[n] = a))
                          }
                        }),
                      [t, n]
                    )
                  })(Ft(a, Ut))),
                  (o = r[0]),
                  Gt(r[1]),
                  (n = o)),
              Bt.set(a, n))
          }),
          e
        )
      }
      function Kt(e, t) {
        void 0 === t && (t = {})
        var n = 'rtl' === t.writingDirection,
          r = (function (e, t) {
            void 0 === t && (t = {})
            var n = t,
              r = n.writingDirection,
              o = oe(n, Wt),
              a = 'rtl' === r
            return Vt.P.factory({
              transform(e) {
                var t = Bt.get(e)
                return null != t ? (0, Tt.n)(t, a) : Ft(e, me(me({}, Ut), o))
              },
            })(e)
          })(e, t)
        return (
          Array.isArray(r) &&
            null != r[1] &&
            (r[1] = (function (e, t) {
              var n = e || Xe,
                r = {},
                o = {},
                a = function () {
                  var e = n[l],
                    a = l,
                    i = e
                  if (!Object.prototype.hasOwnProperty.call(n, l) || null == e) return 'continue'
                  ht.indexOf(l) > -1 &&
                    ('start' === e
                      ? (i = t ? 'right' : 'left')
                      : 'end' === e && (i = t ? 'left' : 'right'))
                  var s = bt[l]
                  if ((null != s && (a = t ? mt[s] : s), 'transitionProperty' === l)) {
                    var u = Array.isArray(e) ? e : [e]
                    u.forEach((e, n) => {
                      if ('string' == typeof e) {
                        var r = bt[e]
                        null != r && ((u[n] = t ? mt[r] : r), (i = u.join(' ')))
                      }
                    })
                  }
                  ;(r[a] || (o[a] = i), a === l && (r[a] = !0))
                }
              for (var l in n) a()
              return Ee(o, !0)
            })(r[1], n)),
          r
        )
      }
      ;((Kt.absoluteFill = Xt),
        (Kt.absoluteFillObject = qt),
        (Kt.create = Yt),
        (Kt.compose = function (e, t) {
          return [e, t]
        }),
        (Kt.flatten = function () {
          for (var e = arguments.length, t = new Array(e), n = 0; n < e; n++) t[n] = arguments[n]
          for (var r = t.flat(1 / 0), o = {}, a = 0; a < r.length; a++) {
            var l = r[a]
            null != l && 'object' == typeof l && Object.assign(o, l)
          }
          return o
        }),
        (Kt.getSheet = function () {
          return { id: Ht.id, textContent: Ht.getTextContent() }
        }),
        (Kt.hairlineWidth = 1),
        ke &&
          window.__REACT_DEVTOOLS_GLOBAL_HOOK__ &&
          (window.__REACT_DEVTOOLS_GLOBAL_HOOK__.resolveRNStyle = Kt.flatten))
      const Qt = Kt
      var Zt = [
          'aria-activedescendant',
          'accessibilityActiveDescendant',
          'aria-atomic',
          'accessibilityAtomic',
          'aria-autocomplete',
          'accessibilityAutoComplete',
          'aria-busy',
          'accessibilityBusy',
          'aria-checked',
          'accessibilityChecked',
          'aria-colcount',
          'accessibilityColumnCount',
          'aria-colindex',
          'accessibilityColumnIndex',
          'aria-colspan',
          'accessibilityColumnSpan',
          'aria-controls',
          'accessibilityControls',
          'aria-current',
          'accessibilityCurrent',
          'aria-describedby',
          'accessibilityDescribedBy',
          'aria-details',
          'accessibilityDetails',
          'aria-disabled',
          'accessibilityDisabled',
          'aria-errormessage',
          'accessibilityErrorMessage',
          'aria-expanded',
          'accessibilityExpanded',
          'aria-flowto',
          'accessibilityFlowTo',
          'aria-haspopup',
          'accessibilityHasPopup',
          'aria-hidden',
          'accessibilityHidden',
          'aria-invalid',
          'accessibilityInvalid',
          'aria-keyshortcuts',
          'accessibilityKeyShortcuts',
          'aria-label',
          'accessibilityLabel',
          'aria-labelledby',
          'accessibilityLabelledBy',
          'aria-level',
          'accessibilityLevel',
          'aria-live',
          'accessibilityLiveRegion',
          'aria-modal',
          'accessibilityModal',
          'aria-multiline',
          'accessibilityMultiline',
          'aria-multiselectable',
          'accessibilityMultiSelectable',
          'aria-orientation',
          'accessibilityOrientation',
          'aria-owns',
          'accessibilityOwns',
          'aria-placeholder',
          'accessibilityPlaceholder',
          'aria-posinset',
          'accessibilityPosInSet',
          'aria-pressed',
          'accessibilityPressed',
          'aria-readonly',
          'accessibilityReadOnly',
          'aria-required',
          'accessibilityRequired',
          'role',
          'accessibilityRole',
          'aria-roledescription',
          'accessibilityRoleDescription',
          'aria-rowcount',
          'accessibilityRowCount',
          'aria-rowindex',
          'accessibilityRowIndex',
          'aria-rowspan',
          'accessibilityRowSpan',
          'aria-selected',
          'accessibilitySelected',
          'aria-setsize',
          'accessibilitySetSize',
          'aria-sort',
          'accessibilitySort',
          'aria-valuemax',
          'accessibilityValueMax',
          'aria-valuemin',
          'accessibilityValueMin',
          'aria-valuenow',
          'accessibilityValueNow',
          'aria-valuetext',
          'accessibilityValueText',
          'dataSet',
          'focusable',
          'id',
          'nativeID',
          'pointerEvents',
          'style',
          'tabIndex',
          'testID',
        ],
        Jt = {},
        en = Object.prototype.hasOwnProperty,
        tn = Array.isArray,
        nn = /[A-Z]/g
      function rn(e) {
        return '-' + e.toLowerCase()
      }
      function on(e) {
        return tn(e) ? e.join(' ') : e
      }
      var an = Qt.create({
        auto: { pointerEvents: 'auto' },
        'box-none': { pointerEvents: 'box-none' },
        'box-only': { pointerEvents: 'box-only' },
        none: { pointerEvents: 'none' },
      })
      var ln = new Set([
          'Arab',
          'Syrc',
          'Samr',
          'Mand',
          'Thaa',
          'Mend',
          'Nkoo',
          'Adlm',
          'Rohg',
          'Hebr',
        ]),
        sn = new Set([
          'ae',
          'ar',
          'arc',
          'bcc',
          'bqi',
          'ckb',
          'dv',
          'fa',
          'far',
          'glk',
          'he',
          'iw',
          'khw',
          'ks',
          'ku',
          'mzn',
          'nqo',
          'pnb',
          'ps',
          'sd',
          'ug',
          'ur',
          'yi',
        ]),
        un = new Map(),
        cn = { direction: 'ltr', locale: 'en-US' },
        dn = (0, o.createContext)(cn)
      function fn(e) {
        return (function (e) {
          var t = un.get(e)
          if (t) return t
          var n = !1
          if (Intl.Locale)
            try {
              var r = new Intl.Locale(e).maximize().script
              n = ln.has(r)
            } catch (t) {
              var o = e.split('-')[0]
              n = sn.has(o)
            }
          else {
            var a = e.split('-')[0]
            n = sn.has(a)
          }
          return (un.set(e, n), n)
        })(e)
          ? 'rtl'
          : 'ltr'
      }
      function pn(e) {
        var t = e.direction,
          n = e.locale,
          r = e.children
        return t || n
          ? o.createElement(dn.Provider, {
              children: r,
              value: { direction: n ? fn(n) : t, locale: n },
            })
          : r
      }
      const mn = (e, t, n) => {
          var r
          e && e.constructor === String && (r = ue(t))
          var a = r || e,
            l = ((e, t, n) => {
              t || (t = Jt)
              var r = t,
                o = r['aria-activedescendant'],
                a = r.accessibilityActiveDescendant,
                l = r['aria-atomic'],
                i = r.accessibilityAtomic,
                s = r['aria-autocomplete'],
                u = r.accessibilityAutoComplete,
                c = r['aria-busy'],
                d = r.accessibilityBusy,
                f = r['aria-checked'],
                p = r.accessibilityChecked,
                m = r['aria-colcount'],
                b = r.accessibilityColumnCount,
                h = r['aria-colindex'],
                g = r.accessibilityColumnIndex,
                y = r['aria-colspan'],
                v = r.accessibilityColumnSpan,
                S = r['aria-controls'],
                w = r.accessibilityControls,
                O = r['aria-current'],
                k = r.accessibilityCurrent,
                x = r['aria-describedby'],
                P = r.accessibilityDescribedBy,
                _ = r['aria-details'],
                C = r.accessibilityDetails,
                E = r['aria-disabled'],
                j = r.accessibilityDisabled,
                T = r['aria-errormessage'],
                R = r.accessibilityErrorMessage,
                N = r['aria-expanded'],
                M = r.accessibilityExpanded,
                A = r['aria-flowto'],
                D = r.accessibilityFlowTo,
                z = r['aria-haspopup'],
                I = r.accessibilityHasPopup,
                $ = r['aria-hidden'],
                L = r.accessibilityHidden,
                F = r['aria-invalid'],
                V = r.accessibilityInvalid,
                W = r['aria-keyshortcuts'],
                B = r.accessibilityKeyShortcuts,
                H = r['aria-label'],
                U = r.accessibilityLabel,
                G = r['aria-labelledby'],
                q = r.accessibilityLabelledBy,
                X = r['aria-level'],
                Y = r.accessibilityLevel,
                K = r['aria-live'],
                Q = r.accessibilityLiveRegion,
                Z = r['aria-modal'],
                J = r.accessibilityModal,
                ee = r['aria-multiline'],
                te = r.accessibilityMultiline,
                ne = r['aria-multiselectable'],
                re = r.accessibilityMultiSelectable,
                ae = r['aria-orientation'],
                le = r.accessibilityOrientation,
                ie = r['aria-owns'],
                se = r.accessibilityOwns,
                ue = r['aria-placeholder'],
                de = r.accessibilityPlaceholder,
                fe = r['aria-posinset'],
                pe = r.accessibilityPosInSet,
                be = r['aria-pressed'],
                he = r.accessibilityPressed,
                ge = r['aria-readonly'],
                ye = r.accessibilityReadOnly,
                ve = r['aria-required'],
                Se = r.accessibilityRequired,
                we = (r.role, r.accessibilityRole, r['aria-roledescription']),
                Oe = r.accessibilityRoleDescription,
                ke = r['aria-rowcount'],
                xe = r.accessibilityRowCount,
                Pe = r['aria-rowindex'],
                _e = r.accessibilityRowIndex,
                Ce = r['aria-rowspan'],
                Ee = r.accessibilityRowSpan,
                je = r['aria-selected'],
                Te = r.accessibilitySelected,
                Re = r['aria-setsize'],
                Ne = r.accessibilitySetSize,
                Me = r['aria-sort'],
                Ae = r.accessibilitySort,
                De = r['aria-valuemax'],
                ze = r.accessibilityValueMax,
                Ie = r['aria-valuemin'],
                $e = r.accessibilityValueMin,
                Le = r['aria-valuenow'],
                Fe = r.accessibilityValueNow,
                Ve = r['aria-valuetext'],
                We = r.accessibilityValueText,
                Be = r.dataSet,
                He = r.focusable,
                Ue = r.id,
                Ge = r.nativeID,
                qe = r.pointerEvents,
                Xe = r.style,
                Ye = r.tabIndex,
                Ke = r.testID,
                Qe = oe(r, Zt),
                Ze = E || j,
                Je = ce(t),
                et = null != o ? o : a
              null != et && (Qe['aria-activedescendant'] = et)
              var tt = null != l ? o : i
              null != tt && (Qe['aria-atomic'] = tt)
              var nt = null != s ? s : u
              null != nt && (Qe['aria-autocomplete'] = nt)
              var rt = null != c ? c : d
              null != rt && (Qe['aria-busy'] = rt)
              var ot = null != f ? f : p
              null != ot && (Qe['aria-checked'] = ot)
              var at = null != m ? m : b
              null != at && (Qe['aria-colcount'] = at)
              var lt = null != h ? h : g
              null != lt && (Qe['aria-colindex'] = lt)
              var it = null != y ? y : v
              null != it && (Qe['aria-colspan'] = it)
              var st = null != S ? S : w
              null != st && (Qe['aria-controls'] = on(st))
              var ut = null != O ? O : k
              null != ut && (Qe['aria-current'] = ut)
              var ct = null != x ? x : P
              null != ct && (Qe['aria-describedby'] = on(ct))
              var dt = null != _ ? _ : C
              ;(null != dt && (Qe['aria-details'] = dt),
                !0 === Ze &&
                  ((Qe['aria-disabled'] = !0),
                  ('button' !== e &&
                    'form' !== e &&
                    'input' !== e &&
                    'select' !== e &&
                    'textarea' !== e) ||
                    (Qe.disabled = !0)))
              var ft = null != T ? T : R
              null != ft && (Qe['aria-errormessage'] = ft)
              var pt = null != N ? N : M
              null != pt && (Qe['aria-expanded'] = pt)
              var mt = null != A ? A : D
              null != mt && (Qe['aria-flowto'] = on(mt))
              var bt = null != z ? z : I
              null != bt && (Qe['aria-haspopup'] = bt)
              var ht = null != $ ? $ : L
              !0 === ht && (Qe['aria-hidden'] = ht)
              var gt = null != F ? F : V
              null != gt && (Qe['aria-invalid'] = gt)
              var yt = null != W ? W : B
              null != yt && (Qe['aria-keyshortcuts'] = on(yt))
              var vt = null != H ? H : U
              null != vt && (Qe['aria-label'] = vt)
              var St = null != G ? G : q
              null != St && (Qe['aria-labelledby'] = on(St))
              var wt = null != X ? X : Y
              null != wt && (Qe['aria-level'] = wt)
              var Ot = null != K ? K : Q
              null != Ot && (Qe['aria-live'] = 'none' === Ot ? 'off' : Ot)
              var kt = null != Z ? Z : J
              null != kt && (Qe['aria-modal'] = kt)
              var xt = null != ee ? ee : te
              null != xt && (Qe['aria-multiline'] = xt)
              var Pt = null != ne ? ne : re
              null != Pt && (Qe['aria-multiselectable'] = Pt)
              var _t = null != ae ? ae : le
              null != _t && (Qe['aria-orientation'] = _t)
              var Ct = null != ie ? ie : se
              null != Ct && (Qe['aria-owns'] = on(Ct))
              var Et = null != ue ? ue : de
              null != Et && (Qe['aria-placeholder'] = Et)
              var jt = null != fe ? fe : pe
              null != jt && (Qe['aria-posinset'] = jt)
              var Tt = null != be ? be : he
              null != Tt && (Qe['aria-pressed'] = Tt)
              var Rt = null != ge ? ge : ye
              null != Rt &&
                ((Qe['aria-readonly'] = Rt),
                ('input' !== e && 'select' !== e && 'textarea' !== e) || (Qe.readOnly = !0))
              var Nt = null != ve ? ve : Se
              ;(null != Nt &&
                ((Qe['aria-required'] = Nt),
                ('input' !== e && 'select' !== e && 'textarea' !== e) || (Qe.required = Se)),
                null != Je && (Qe.role = 'none' === Je ? 'presentation' : Je))
              var Mt = null != we ? we : Oe
              null != Mt && (Qe['aria-roledescription'] = Mt)
              var At = null != ke ? ke : xe
              null != At && (Qe['aria-rowcount'] = At)
              var Dt = null != Pe ? Pe : _e
              null != Dt && (Qe['aria-rowindex'] = Dt)
              var zt = null != Ce ? Ce : Ee
              null != zt && (Qe['aria-rowspan'] = zt)
              var It = null != je ? je : Te
              null != It && (Qe['aria-selected'] = It)
              var $t = null != Re ? Re : Ne
              null != $t && (Qe['aria-setsize'] = $t)
              var Lt = null != Me ? Me : Ae
              null != Lt && (Qe['aria-sort'] = Lt)
              var Ft = null != De ? De : ze
              null != Ft && (Qe['aria-valuemax'] = Ft)
              var Vt = null != Ie ? Ie : $e
              null != Vt && (Qe['aria-valuemin'] = Vt)
              var Wt = null != Le ? Le : Fe
              null != Wt && (Qe['aria-valuenow'] = Wt)
              var Bt = null != Ve ? Ve : We
              if ((null != Bt && (Qe['aria-valuetext'] = Bt), null != Be))
                for (var Ht in Be)
                  if (en.call(Be, Ht)) {
                    var Ut = Ht.replace(nn, rn),
                      Gt = Be[Ht]
                    null != Gt && (Qe['data-' + Ut] = Gt)
                  }
              0 === Ye || '0' === Ye || -1 === Ye || '-1' === Ye
                ? (Qe.tabIndex = Ye)
                : (!1 === He && (Qe.tabIndex = '-1'),
                  'a' === e || 'button' === e || 'input' === e || 'select' === e || 'textarea' === e
                    ? (!1 !== He && !0 !== j) || (Qe.tabIndex = '-1')
                    : 'button' === Je ||
                        'checkbox' === Je ||
                        'link' === Je ||
                        'radio' === Je ||
                        'textbox' === Je ||
                        'switch' === Je
                      ? !1 !== He && (Qe.tabIndex = '0')
                      : !0 === He && (Qe.tabIndex = '0'))
              var qt = Qt([Xe, qe && an[qe]], me({ writingDirection: 'ltr' }, n)),
                Xt = qt[0],
                Yt = qt[1]
              ;(Xt && (Qe.className = Xt), Yt && (Qe.style = Yt))
              var Kt = null != Ue ? Ue : Ge
              return (
                null != Kt && (Qe.id = Kt),
                null != Ke && (Qe['data-testid'] = Ke),
                null == Qe.type && 'button' === e && (Qe.type = 'button'),
                Qe
              )
            })(a, t, n),
            i = o.createElement(a, l)
          return l.dir ? o.createElement(pn, { children: i, direction: l.dir, locale: l.lang }) : i
        },
        bn = ke ? o.useLayoutEffect : o.useEffect,
        hn = (e) => {
          if (null != e && 1 === e.nodeType && 'function' == typeof e.getBoundingClientRect)
            return e.getBoundingClientRect()
        }
      var gn = {
          animationIterationCount: !0,
          aspectRatio: !0,
          borderImageOutset: !0,
          borderImageSlice: !0,
          borderImageWidth: !0,
          boxFlex: !0,
          boxFlexGroup: !0,
          boxOrdinalGroup: !0,
          columnCount: !0,
          flex: !0,
          flexGrow: !0,
          flexOrder: !0,
          flexPositive: !0,
          flexShrink: !0,
          flexNegative: !0,
          fontWeight: !0,
          gridRow: !0,
          gridRowEnd: !0,
          gridRowGap: !0,
          gridRowStart: !0,
          gridColumn: !0,
          gridColumnEnd: !0,
          gridColumnGap: !0,
          gridColumnStart: !0,
          lineClamp: !0,
          opacity: !0,
          order: !0,
          orphans: !0,
          tabSize: !0,
          widows: !0,
          zIndex: !0,
          zoom: !0,
          fillOpacity: !0,
          floodOpacity: !0,
          stopOpacity: !0,
          strokeDasharray: !0,
          strokeDashoffset: !0,
          strokeMiterlimit: !0,
          strokeOpacity: !0,
          strokeWidth: !0,
          scale: !0,
          scaleX: !0,
          scaleY: !0,
          scaleZ: !0,
          shadowOpacity: !0,
        },
        yn = ['ms', 'Moz', 'O', 'Webkit']
      Object.keys(gn).forEach((e) => {
        yn.forEach((t) => {
          gn[((e, t) => e + t.charAt(0).toUpperCase() + t.substring(1))(t, e)] = gn[e]
        })
      })
      const vn = gn,
        Sn = function (e, t, n) {
          return null == t || 'boolean' == typeof t || '' === t
            ? ''
            : n || 'number' != typeof t || 0 === t || (vn.hasOwnProperty(e) && vn[e])
              ? ('' + t).trim()
              : t + 'px'
        },
        wn = function (e, t) {
          var n = e.style
          for (var r in t)
            if (t.hasOwnProperty(r)) {
              var o = 0 === r.indexOf('--'),
                a = Sn(r, t[r], o)
              ;('float' === r && (r = 'cssFloat'), o ? n.setProperty(r, a) : (n[r] = a))
            }
        }
      var On = (e) => {
          var t = e.offsetHeight,
            n = e.offsetWidth,
            r = e.offsetLeft,
            o = e.offsetTop
          for (e = e.offsetParent; e && 1 === e.nodeType; )
            ((r += e.offsetLeft + e.clientLeft - e.scrollLeft),
              (o += e.offsetTop + e.clientTop - e.scrollTop),
              (e = e.offsetParent))
          return { width: n, height: t, top: (o -= window.scrollY), left: (r -= window.scrollX) }
        },
        kn = (e, t, n) => {
          var r = t || (e && e.parentNode)
          e &&
            r &&
            setTimeout(() => {
              if (e.isConnected && r.isConnected) {
                var t = On(r),
                  o = On(e),
                  a = o.height,
                  l = o.left,
                  i = o.top,
                  s = o.width,
                  u = l - t.left,
                  c = i - t.top
                n(u, c, s, a, l, i)
              }
            }, 0)
        },
        xn = { A: !0, BODY: !0, INPUT: !0, SELECT: !0, TEXTAREA: !0 },
        Pn = {
          blur(e) {
            try {
              e.blur()
            } catch (e) {}
          },
          focus(e) {
            try {
              var t = e.nodeName
              ;(null == e.getAttribute('tabIndex') &&
                !0 !== e.isContentEditable &&
                null == xn[t] &&
                e.setAttribute('tabIndex', '-1'),
                e.focus())
            } catch (e) {}
          },
          measure(e, t) {
            kn(e, null, t)
          },
          measureInWindow(e, t) {
            e &&
              setTimeout(() => {
                var n = hn(e),
                  r = n.height,
                  o = n.left,
                  a = n.top,
                  l = n.width
                t(o, a, l, r)
              }, 0)
          },
          measureLayout(e, t, n, r) {
            kn(e, t, r)
          },
          updateView(e, t) {
            for (var n in t)
              if (Object.prototype.hasOwnProperty.call(t, n)) {
                var r = t[n]
                switch (n) {
                  case 'style':
                    wn(e, r)
                    break
                  case 'class':
                  case 'className':
                    e.setAttribute('class', r)
                    break
                  case 'text':
                  case 'value':
                    e.value = r
                    break
                  default:
                    e.setAttribute(n, r)
                }
              }
          },
          configureNextLayoutAnimation(e, t) {
            t()
          },
          setLayoutAnimationEnabledExperimental() {},
        }
      const _n = Pn
      var Cn = '__reactLayoutHandler',
        En = null
      var jn =
        'function' == typeof Symbol && 'symbol' == typeof Symbol() ? Symbol() : Object.freeze({})
      function Tn(e) {
        return (
          e.pointerEvents,
          e.style,
          (t = o.useRef(jn)).current === jn &&
            (t.current = (e) => {
              null != e &&
                ((e.measure = (t) => _n.measure(e, t)),
                (e.measureLayout = (t, n, r) => _n.measureLayout(e, t, r, n)),
                (e.measureInWindow = (t) => _n.measureInWindow(e, t)))
            }),
          t.current
        )
        var t
      }
      var Rn = () => {},
        Nn = {},
        Mn = []
      function An(e) {
        return e > 20 ? e % 20 : e
      }
      function Dn(e, t) {
        var n,
          r,
          o,
          a = !1,
          l = e.changedTouches,
          i = e.type,
          s = !0 === e.metaKey,
          u = !0 === e.shiftKey,
          c = (l && l[0].force) || 0,
          d = An((l && l[0].identifier) || 0),
          f = (l && l[0].clientX) || e.clientX,
          p = (l && l[0].clientY) || e.clientY,
          m = (l && l[0].pageX) || e.pageX,
          b = (l && l[0].pageY) || e.pageY,
          h = 'function' == typeof e.preventDefault ? e.preventDefault.bind(e) : Rn,
          g = e.timeStamp
        function y(e) {
          return Array.prototype.slice.call(e).map((e) => ({
            force: e.force,
            identifier: An(e.identifier),
            get locationX() {
              return w(e.clientX)
            },
            get locationY() {
              return O(e.clientY)
            },
            pageX: e.pageX,
            pageY: e.pageY,
            target: e.target,
            timestamp: g,
          }))
        }
        if (null != l) ((r = y(l)), (o = y(e.touches)))
        else {
          var v = [
            {
              force: c,
              identifier: d,
              get locationX() {
                return w(f)
              },
              get locationY() {
                return O(p)
              },
              pageX: m,
              pageY: b,
              target: e.target,
              timestamp: g,
            },
          ]
          ;((r = v), (o = 'mouseup' === i || 'dragstart' === i ? Mn : v))
        }
        var S = {
          bubbles: !0,
          cancelable: !0,
          currentTarget: null,
          defaultPrevented: e.defaultPrevented,
          dispatchConfig: Nn,
          eventPhase: e.eventPhase,
          isDefaultPrevented: () => e.defaultPrevented,
          isPropagationStopped: () => a,
          isTrusted: e.isTrusted,
          nativeEvent: {
            altKey: !1,
            ctrlKey: !1,
            metaKey: s,
            shiftKey: u,
            changedTouches: r,
            force: c,
            identifier: d,
            get locationX() {
              return w(f)
            },
            get locationY() {
              return O(p)
            },
            pageX: m,
            pageY: b,
            target: e.target,
            timestamp: g,
            touches: o,
            type: i,
          },
          persist: Rn,
          preventDefault: h,
          stopPropagation() {
            a = !0
          },
          target: e.target,
          timeStamp: g,
          touchHistory: t.touchHistory,
        }
        function w(e) {
          if ((n = n || hn(S.currentTarget))) return e - n.left
        }
        function O(e) {
          if ((n = n || hn(S.currentTarget))) return e - n.top
        }
        return S
      }
      var zn = 'mousedown',
        In = 'mousemove',
        $n = 'mouseup',
        Ln = 'dragstart',
        Fn = 'touchstart',
        Vn = 'touchmove',
        Wn = 'touchend',
        Bn = 'touchcancel',
        Hn = 'scroll',
        Un = 'select',
        Gn = 'selectionchange'
      function qn(e) {
        return e === Fn || e === zn
      }
      function Xn(e) {
        return e === Vn || e === In
      }
      function Yn(e) {
        return e === Wn || e === $n || Kn(e)
      }
      function Kn(e) {
        return e === Bn || e === Ln
      }
      var Qn = '__reactResponderId'
      function Zn(e) {
        for (var t = []; null != e && e !== document.body; ) (t.push(e), (e = e.parentNode))
        return t
      }
      function Jn(e) {
        return null != e ? e[Qn] : null
      }
      var er = !1,
        tr = 20
      function nr(e) {
        return e.timeStamp || e.timestamp
      }
      function rr(e) {
        var t = e.identifier
        return (
          null == t && console.error('Touch object is missing identifier.'),
          er &&
            t > tr &&
            console.error(
              'Touch identifier %s is greater than maximum supported %s which causes performance issues backfilling array locations for all of the indices.',
              t,
              tr
            ),
          t
        )
      }
      function or(e) {
        return JSON.stringify({
          identifier: e.identifier,
          pageX: e.pageX,
          pageY: e.pageY,
          timestamp: nr(e),
        })
      }
      function ar(e) {
        var t = e.touchBank,
          n = JSON.stringify(t.slice(0, tr))
        return (t.length > tr && (n += ' (original size: ' + t.length + ')'), n)
      }
      var lr = {},
        ir = ['onStartShouldSetResponderCapture', 'onStartShouldSetResponder', { bubbles: !0 }],
        sr = ['onMoveShouldSetResponderCapture', 'onMoveShouldSetResponder', { bubbles: !0 }],
        ur = {
          touchstart: ir,
          mousedown: ir,
          touchmove: sr,
          mousemove: sr,
          scroll: [
            'onScrollShouldSetResponderCapture',
            'onScrollShouldSetResponder',
            { bubbles: !1 },
          ],
        },
        cr = { id: null, idPath: null, node: null },
        dr = new Map(),
        fr = !1,
        pr = 0,
        mr = { id: null, node: null, idPath: null },
        br = new (class {
          constructor() {
            this._touchHistory = {
              touchBank: [],
              numberActiveTouches: 0,
              indexOfSingleActiveTouch: -1,
              mostRecentTimeStamp: 0,
            }
          }
          recordTouchTrack(e, t) {
            var n = this._touchHistory
            if (Xn(e))
              t.changedTouches.forEach((e) =>
                (function (e, t) {
                  var n = t.touchBank[rr(e)]
                  n
                    ? ((n.touchActive = !0),
                      (n.previousPageX = n.currentPageX),
                      (n.previousPageY = n.currentPageY),
                      (n.previousTimeStamp = n.currentTimeStamp),
                      (n.currentPageX = e.pageX),
                      (n.currentPageY = e.pageY),
                      (n.currentTimeStamp = nr(e)),
                      (t.mostRecentTimeStamp = nr(e)))
                    : console.warn(
                        'Cannot record touch move without a touch start.\n',
                        'Touch Move: ' + or(e) + '\n',
                        'Touch Bank: ' + ar(t)
                      )
                })(e, n)
              )
            else if (qn(e))
              (t.changedTouches.forEach((e) =>
                (function (e, t) {
                  var n = rr(e),
                    r = t.touchBank[n]
                  ;(r
                    ? (function (e, t) {
                        ;((e.touchActive = !0),
                          (e.startPageX = t.pageX),
                          (e.startPageY = t.pageY),
                          (e.startTimeStamp = nr(t)),
                          (e.currentPageX = t.pageX),
                          (e.currentPageY = t.pageY),
                          (e.currentTimeStamp = nr(t)),
                          (e.previousPageX = t.pageX),
                          (e.previousPageY = t.pageY),
                          (e.previousTimeStamp = nr(t)))
                      })(r, e)
                    : (t.touchBank[n] = (function (e) {
                        return {
                          touchActive: !0,
                          startPageX: e.pageX,
                          startPageY: e.pageY,
                          startTimeStamp: nr(e),
                          currentPageX: e.pageX,
                          currentPageY: e.pageY,
                          currentTimeStamp: nr(e),
                          previousPageX: e.pageX,
                          previousPageY: e.pageY,
                          previousTimeStamp: nr(e),
                        }
                      })(e)),
                    (t.mostRecentTimeStamp = nr(e)))
                })(e, n)
              ),
                (n.numberActiveTouches = t.touches.length),
                1 === n.numberActiveTouches &&
                  (n.indexOfSingleActiveTouch = t.touches[0].identifier))
            else if (
              Yn(e) &&
              (t.changedTouches.forEach((e) =>
                (function (e, t) {
                  var n = t.touchBank[rr(e)]
                  n
                    ? ((n.touchActive = !1),
                      (n.previousPageX = n.currentPageX),
                      (n.previousPageY = n.currentPageY),
                      (n.previousTimeStamp = n.currentTimeStamp),
                      (n.currentPageX = e.pageX),
                      (n.currentPageY = e.pageY),
                      (n.currentTimeStamp = nr(e)),
                      (t.mostRecentTimeStamp = nr(e)))
                    : console.warn(
                        'Cannot record touch end without a touch start.\n',
                        'Touch End: ' + or(e) + '\n',
                        'Touch Bank: ' + ar(t)
                      )
                })(e, n)
              ),
              (n.numberActiveTouches = t.touches.length),
              1 === n.numberActiveTouches)
            ) {
              for (var r = n.touchBank, o = 0; o < r.length; o++) {
                var a = r[o]
                if (null != a && a.touchActive) {
                  n.indexOfSingleActiveTouch = o
                  break
                }
              }
              if (er) {
                var l = r[n.indexOfSingleActiveTouch]
                ;(null != l && l.touchActive) || console.error('Cannot find single active touch.')
              }
            }
          }
          get touchHistory() {
            return this._touchHistory
          }
        })()
      function hr(e) {
        mr = e
      }
      function gr(e) {
        var t = dr.get(e)
        return null != t ? t : lr
      }
      function yr(e) {
        var t = e.type,
          n = e.target
        if (
          ('touchstart' === t && (fr = !0),
          ('touchmove' === t || pr > 1) && (fr = !1),
          !(
            ('mousedown' === t && fr) ||
            ('mousemove' === t && fr) ||
            ('mousemove' === t && pr < 1)
          ))
        )
          if (fr && 'mouseup' === t) 0 === pr && (fr = !1)
          else {
            var r =
                qn(t) &&
                (function (e) {
                  var t = e.altKey,
                    n = e.button,
                    r = e.buttons,
                    o = e.ctrlKey,
                    a = e.type,
                    l = !1 === t && !1 === o
                  return !!(
                    'touchstart' === a ||
                    'touchmove' === a ||
                    ('mousedown' === a && (0 === n || 1 === r) && l) ||
                    ('mousemove' === a && 1 === r && l)
                  )
                })(e),
              o = Xn(t),
              a = Yn(t),
              l = (function (e) {
                return e === Hn
              })(t),
              i = (function (e) {
                return e === Un || e === Gn
              })(t),
              s = Dn(e, br)
            ;(r || o || a) &&
              (e.touches ? (pr = e.touches.length) : r ? (pr = 1) : a && (pr = 0),
              br.recordTouchTrack(t, s.nativeEvent))
            var u,
              c = (function (e) {
                for (
                  var t = [],
                    n = [],
                    r = (function (e) {
                      return 'selectionchange' === e.type
                        ? Zn(window.getSelection().anchorNode)
                        : null != e.composedPath
                          ? e.composedPath()
                          : Zn(e.target)
                    })(e),
                    o = 0;
                  o < r.length;
                  o++
                ) {
                  var a = r[o],
                    l = Jn(a)
                  null != l && (t.push(l), n.push(a))
                }
                return { idPath: t, nodePath: n }
              })(e),
              d = !1
            if (r || o || (l && pr > 0)) {
              var f = mr.idPath,
                p = c.idPath
              if (null != f && null != p) {
                var m = (function (e, t) {
                  var n = e.length,
                    r = t.length
                  if (0 === n || 0 === r || e[n - 1] !== t[r - 1]) return null
                  var o = e[0],
                    a = 0,
                    l = t[0],
                    i = 0
                  ;(n - r > 0 && ((o = e[(a = n - r)]), (n = r)),
                    r - n > 0 && ((l = t[(i = r - n)]), (r = n)))
                  for (var s = n; s--; ) {
                    if (o === l) return o
                    ;((o = e[a++]), (l = t[i++]))
                  }
                  return null
                })(f, p)
                if (null != m) {
                  var b = p.indexOf(m) + (m === mr.id ? 1 : 0)
                  c = { idPath: p.slice(b), nodePath: c.nodePath.slice(b) }
                } else c = null
              }
              null != c &&
                ((u = (function (e, t, n) {
                  var r = ur[t.type]
                  if (null != r) {
                    for (
                      var o = e.idPath,
                        a = e.nodePath,
                        l = r[0],
                        i = r[1],
                        s = r[2].bubbles,
                        u = function (e, t, r) {
                          var a = gr(e)[r]
                          if (null != a && ((n.currentTarget = t), !0 === a(n)))
                            return { id: e, node: t, idPath: o.slice(o.indexOf(e)) }
                        },
                        c = o.length - 1;
                      c >= 0;
                      c--
                    ) {
                      var d = u(o[c], a[c], l)
                      if (null != d) return d
                      if (!0 === n.isPropagationStopped()) return
                    }
                    if (s)
                      for (var f = 0; f < o.length; f++) {
                        var p = u(o[f], a[f], i)
                        if (null != p) return p
                        if (!0 === n.isPropagationStopped()) return
                      }
                    else {
                      var m = o[0],
                        b = a[0]
                      if (t.target === b) return u(m, b, i)
                    }
                  }
                })(c, e, s)),
                null != u &&
                  ((function (e, t) {
                    var n = mr,
                      r = n.id,
                      o = n.node,
                      a = t.id,
                      l = t.node,
                      i = gr(a),
                      s = i.onResponderGrant,
                      u = i.onResponderReject
                    if (((e.bubbles = !1), (e.cancelable = !1), (e.currentTarget = l), null == r))
                      (null != s &&
                        ((e.currentTarget = l),
                        (e.dispatchConfig.registrationName = 'onResponderGrant'),
                        s(e)),
                        hr(t))
                    else {
                      var c = gr(r),
                        d = c.onResponderTerminate,
                        f = c.onResponderTerminationRequest,
                        p = !0
                      ;(null != f &&
                        ((e.currentTarget = o),
                        (e.dispatchConfig.registrationName = 'onResponderTerminationRequest'),
                        !1 === f(e) && (p = !1)),
                        p
                          ? (null != d &&
                              ((e.currentTarget = o),
                              (e.dispatchConfig.registrationName = 'onResponderTerminate'),
                              d(e)),
                            null != s &&
                              ((e.currentTarget = l),
                              (e.dispatchConfig.registrationName = 'onResponderGrant'),
                              s(e)),
                            hr(t))
                          : null != u &&
                            ((e.currentTarget = l),
                            (e.dispatchConfig.registrationName = 'onResponderReject'),
                            u(e)))
                    }
                  })(s, u),
                  (d = !0)))
            }
            if (null != mr.id && null != mr.node) {
              var h = mr,
                g = h.id,
                y = h.node,
                v = gr(g),
                S = v.onResponderStart,
                w = v.onResponderMove,
                O = v.onResponderEnd,
                k = v.onResponderRelease,
                x = v.onResponderTerminate,
                P = v.onResponderTerminationRequest
              if (((s.bubbles = !1), (s.cancelable = !1), (s.currentTarget = y), r))
                null != S && ((s.dispatchConfig.registrationName = 'onResponderStart'), S(s))
              else if (o)
                null != w && ((s.dispatchConfig.registrationName = 'onResponderMove'), w(s))
              else {
                var _ =
                    Kn(t) ||
                    'contextmenu' === t ||
                    ('blur' === t && n === window) ||
                    ('blur' === t && n.contains(y) && e.relatedTarget !== y) ||
                    (l && 0 === pr) ||
                    (l && n.contains(y) && n !== y) ||
                    (i &&
                      (function (e) {
                        return 'selectionchange' === e.type
                          ? ((n = (t = window.getSelection()).toString()),
                            (r = t.anchorNode),
                            (o = t.focusNode),
                            (a =
                              (r && r.nodeType === window.Node.TEXT_NODE) ||
                              (o && o.nodeType === window.Node.TEXT_NODE)),
                            n.length >= 1 && '\n' !== n && a)
                          : 'select' === e.type
                        var t, n, r, o, a
                      })(e)),
                  C =
                    a &&
                    !_ &&
                    !(function (e, t) {
                      if (!t || 0 === t.length) return !1
                      for (var n = 0; n < t.length; n++) {
                        var r = t[n].target
                        if (null != r && e.contains(r)) return !0
                      }
                      return !1
                    })(y, e.touches)
                if (
                  (a && null != O && ((s.dispatchConfig.registrationName = 'onResponderEnd'), O(s)),
                  C &&
                    (null != k &&
                      ((s.dispatchConfig.registrationName = 'onResponderRelease'), k(s)),
                    hr(cr)),
                  _)
                ) {
                  var E = !0
                  ;(('contextmenu' !== t && 'scroll' !== t && 'selectionchange' !== t) ||
                    (d
                      ? (E = !1)
                      : null != P &&
                        ((s.dispatchConfig.registrationName = 'onResponderTerminationRequest'),
                        !1 === P(s) && (E = !1))),
                    E &&
                      (null != x &&
                        ((s.dispatchConfig.registrationName = 'onResponderTerminate'), x(s)),
                      hr(cr),
                      (fr = !1),
                      (pr = 0)))
                }
              }
            }
          }
      }
      var vr = ['blur', 'scroll'],
        Sr = [
          'mousedown',
          'mousemove',
          'mouseup',
          'dragstart',
          'touchstart',
          'touchmove',
          'touchend',
          'touchcancel',
          'contextmenu',
          'select',
          'selectionchange',
        ]
      function wr(e) {
        ;(mr.id === e &&
          (function () {
            var e = mr,
              t = e.id,
              n = e.node
            if (null != t && null != n) {
              var r = gr(t).onResponderTerminate
              if (null != r) {
                var o = Dn({}, br)
                ;((o.currentTarget = n), r(o))
              }
              hr(cr)
            }
            ;((fr = !1), (pr = 0))
          })(),
          dr.has(e) && dr.delete(e))
      }
      var Or = {},
        kr = 0
      function xr(e, t) {
        void 0 === t && (t = Or)
        var n,
          r,
          a =
            ((n = () => kr++),
            null == (r = o.useRef(null)).current && (r.current = n()),
            r.current),
          l = o.useRef(!1)
        ;(o.useEffect(
          () => (
            ke &&
              null == window.__reactResponderSystemActive &&
              (window.addEventListener('blur', yr),
              Sr.forEach((e) => {
                document.addEventListener(e, yr)
              }),
              vr.forEach((e) => {
                document.addEventListener(e, yr, !0)
              }),
              (window.__reactResponderSystemActive = !0)),
            () => {
              wr(a)
            }
          ),
          [a]
        ),
          o.useEffect(() => {
            var n = t,
              r = n.onMoveShouldSetResponder,
              o = n.onMoveShouldSetResponderCapture,
              i = n.onScrollShouldSetResponder,
              s = n.onScrollShouldSetResponderCapture,
              u = n.onSelectionChangeShouldSetResponder,
              c = n.onSelectionChangeShouldSetResponderCapture,
              d = n.onStartShouldSetResponder,
              f = n.onStartShouldSetResponderCapture,
              p =
                null != r ||
                null != o ||
                null != i ||
                null != s ||
                null != u ||
                null != c ||
                null != d ||
                null != f,
              m = e.current
            p
              ? ((function (e, t, n) {
                  ;(!(function (e, t) {
                    null != e && (e[Qn] = t)
                  })(t, e),
                    dr.set(e, n))
                })(a, m, t),
                (l.current = !0))
              : l.current && (wr(a), (l.current = !1))
          }, [t, e, a]),
          o.useDebugValue({ isResponder: e.current === mr.node }),
          o.useDebugValue(t))
      }
      const Pr = (0, o.createContext)(!1)
      var _r = [
          'hrefAttrs',
          'onLayout',
          'onMoveShouldSetResponder',
          'onMoveShouldSetResponderCapture',
          'onResponderEnd',
          'onResponderGrant',
          'onResponderMove',
          'onResponderReject',
          'onResponderRelease',
          'onResponderStart',
          'onResponderTerminate',
          'onResponderTerminationRequest',
          'onScrollShouldSetResponder',
          'onScrollShouldSetResponderCapture',
          'onSelectionChangeShouldSetResponder',
          'onSelectionChangeShouldSetResponderCapture',
          'onStartShouldSetResponder',
          'onStartShouldSetResponderCapture',
        ],
        Cr = Object.assign(
          {},
          {
            children: !0,
            dataSet: !0,
            dir: !0,
            id: !0,
            ref: !0,
            suppressHydrationWarning: !0,
            tabIndex: !0,
            testID: !0,
            focusable: !0,
            nativeID: !0,
          },
          {
            'aria-activedescendant': !0,
            'aria-atomic': !0,
            'aria-autocomplete': !0,
            'aria-busy': !0,
            'aria-checked': !0,
            'aria-colcount': !0,
            'aria-colindex': !0,
            'aria-colspan': !0,
            'aria-controls': !0,
            'aria-current': !0,
            'aria-describedby': !0,
            'aria-details': !0,
            'aria-disabled': !0,
            'aria-errormessage': !0,
            'aria-expanded': !0,
            'aria-flowto': !0,
            'aria-haspopup': !0,
            'aria-hidden': !0,
            'aria-invalid': !0,
            'aria-keyshortcuts': !0,
            'aria-label': !0,
            'aria-labelledby': !0,
            'aria-level': !0,
            'aria-live': !0,
            'aria-modal': !0,
            'aria-multiline': !0,
            'aria-multiselectable': !0,
            'aria-orientation': !0,
            'aria-owns': !0,
            'aria-placeholder': !0,
            'aria-posinset': !0,
            'aria-pressed': !0,
            'aria-readonly': !0,
            'aria-required': !0,
            role: !0,
            'aria-roledescription': !0,
            'aria-rowcount': !0,
            'aria-rowindex': !0,
            'aria-rowspan': !0,
            'aria-selected': !0,
            'aria-setsize': !0,
            'aria-sort': !0,
            'aria-valuemax': !0,
            'aria-valuemin': !0,
            'aria-valuenow': !0,
            'aria-valuetext': !0,
            accessibilityActiveDescendant: !0,
            accessibilityAtomic: !0,
            accessibilityAutoComplete: !0,
            accessibilityBusy: !0,
            accessibilityChecked: !0,
            accessibilityColumnCount: !0,
            accessibilityColumnIndex: !0,
            accessibilityColumnSpan: !0,
            accessibilityControls: !0,
            accessibilityCurrent: !0,
            accessibilityDescribedBy: !0,
            accessibilityDetails: !0,
            accessibilityDisabled: !0,
            accessibilityErrorMessage: !0,
            accessibilityExpanded: !0,
            accessibilityFlowTo: !0,
            accessibilityHasPopup: !0,
            accessibilityHidden: !0,
            accessibilityInvalid: !0,
            accessibilityKeyShortcuts: !0,
            accessibilityLabel: !0,
            accessibilityLabelledBy: !0,
            accessibilityLevel: !0,
            accessibilityLiveRegion: !0,
            accessibilityModal: !0,
            accessibilityMultiline: !0,
            accessibilityMultiSelectable: !0,
            accessibilityOrientation: !0,
            accessibilityOwns: !0,
            accessibilityPlaceholder: !0,
            accessibilityPosInSet: !0,
            accessibilityPressed: !0,
            accessibilityReadOnly: !0,
            accessibilityRequired: !0,
            accessibilityRole: !0,
            accessibilityRoleDescription: !0,
            accessibilityRowCount: !0,
            accessibilityRowIndex: !0,
            accessibilityRowSpan: !0,
            accessibilitySelected: !0,
            accessibilitySetSize: !0,
            accessibilitySort: !0,
            accessibilityValueMax: !0,
            accessibilityValueMin: !0,
            accessibilityValueNow: !0,
            accessibilityValueText: !0,
          },
          {
            onClick: !0,
            onAuxClick: !0,
            onContextMenu: !0,
            onGotPointerCapture: !0,
            onLostPointerCapture: !0,
            onPointerCancel: !0,
            onPointerDown: !0,
            onPointerEnter: !0,
            onPointerMove: !0,
            onPointerLeave: !0,
            onPointerOut: !0,
            onPointerOver: !0,
            onPointerUp: !0,
          },
          { onBlur: !0, onFocus: !0 },
          { onKeyDown: !0, onKeyDownCapture: !0, onKeyUp: !0, onKeyUpCapture: !0 },
          {
            onMouseDown: !0,
            onMouseEnter: !0,
            onMouseLeave: !0,
            onMouseMove: !0,
            onMouseOver: !0,
            onMouseOut: !0,
            onMouseUp: !0,
          },
          {
            onTouchCancel: !0,
            onTouchCancelCapture: !0,
            onTouchEnd: !0,
            onTouchEndCapture: !0,
            onTouchMove: !0,
            onTouchMoveCapture: !0,
            onTouchStart: !0,
            onTouchStartCapture: !0,
          },
          { style: !0 },
          { href: !0, lang: !0, onScroll: !0, onWheel: !0, pointerEvents: !0 }
        ),
        Er = o.forwardRef((e, t) => {
          var n = e.hrefAttrs,
            r = e.onLayout,
            a = e.onMoveShouldSetResponder,
            l = e.onMoveShouldSetResponderCapture,
            i = e.onResponderEnd,
            s = e.onResponderGrant,
            u = e.onResponderMove,
            c = e.onResponderReject,
            d = e.onResponderRelease,
            f = e.onResponderStart,
            p = e.onResponderTerminate,
            m = e.onResponderTerminationRequest,
            b = e.onScrollShouldSetResponder,
            h = e.onScrollShouldSetResponderCapture,
            g = e.onSelectionChangeShouldSetResponder,
            y = e.onSelectionChangeShouldSetResponderCapture,
            v = e.onStartShouldSetResponder,
            S = e.onStartShouldSetResponderCapture,
            w = oe(e, _r),
            O = o.useContext(Pr),
            k = o.useRef(null),
            x = (0, o.useContext)(dn).direction
          ;((function (e, t) {
            var n =
              (ke &&
                void 0 !== window.ResizeObserver &&
                null == En &&
                (En = new window.ResizeObserver(function (e) {
                  e.forEach((e) => {
                    var t = e.target,
                      n = t[Cn]
                    'function' == typeof n &&
                      _n.measure(t, (t, r, o, a, l, i) => {
                        var s = {
                          nativeEvent: {
                            layout: { x: t, y: r, width: o, height: a, left: l, top: i },
                          },
                          timeStamp: Date.now(),
                        }
                        ;(Object.defineProperty(s.nativeEvent, 'target', {
                          enumerable: !0,
                          get: () => e.target,
                        }),
                          n(s))
                      })
                  })
                })),
              En)
            ;(bn(() => {
              var n = e.current
              null != n && (n[Cn] = t)
            }, [e, t]),
              bn(() => {
                var t = e.current
                return (
                  null != t &&
                    null != n &&
                    ('function' == typeof t[Cn] ? n.observe(t) : n.unobserve(t)),
                  () => {
                    null != t && null != n && n.unobserve(t)
                  }
                )
              }, [e, n]))
          })(k, r),
            xr(k, {
              onMoveShouldSetResponder: a,
              onMoveShouldSetResponderCapture: l,
              onResponderEnd: i,
              onResponderGrant: s,
              onResponderMove: u,
              onResponderReject: c,
              onResponderRelease: d,
              onResponderStart: f,
              onResponderTerminate: p,
              onResponderTerminationRequest: m,
              onScrollShouldSetResponder: b,
              onScrollShouldSetResponderCapture: h,
              onSelectionChangeShouldSetResponder: g,
              onSelectionChangeShouldSetResponderCapture: y,
              onStartShouldSetResponder: v,
              onStartShouldSetResponderCapture: S,
            }))
          var P = 'div',
            _ = null != e.lang ? fn(e.lang) : null,
            C = e.dir || _,
            E = C || x,
            j = ((e) =>
              (function (e, t) {
                var n = {}
                for (var r in e) e.hasOwnProperty(r) && !0 === t[r] && (n[r] = e[r])
                return n
              })(e, Cr))(w)
          if (
            ((j.dir = C),
            (j.style = [jr.view$raw, O && jr.inline, e.style]),
            null != e.href && ((P = 'a'), null != n))
          ) {
            var T = n.download,
              R = n.rel,
              N = n.target
            ;(null != T && (j.download = T),
              null != R && (j.rel = R),
              'string' == typeof N && (j.target = '_' !== N.charAt(0) ? '_' + N : N))
          }
          var M = (function () {
            for (var e = arguments.length, t = new Array(e), n = 0; n < e; n++) t[n] = arguments[n]
            return o.useMemo(
              () =>
                (function () {
                  for (var e = arguments.length, t = new Array(e), n = 0; n < e; n++)
                    t[n] = arguments[n]
                  return function (e) {
                    t.forEach((t) => {
                      null != t &&
                        ('function' != typeof t
                          ? 'object' != typeof t
                            ? console.error(
                                'mergeRefs cannot handle Refs of type boolean, number or string, received ref ' +
                                  String(t)
                              )
                            : (t.current = e)
                          : t(e))
                    })
                  }
                })(...t),
              [...t]
            )
          })(k, Tn(j), t)
          return ((j.ref = M), mn(P, j, { writingDirection: E }))
        })
      Er.displayName = 'View'
      var jr = Qt.create({
        view$raw: {
          alignContent: 'flex-start',
          alignItems: 'stretch',
          backgroundColor: 'transparent',
          border: '0 solid black',
          boxSizing: 'border-box',
          display: 'flex',
          flexBasis: 'auto',
          flexDirection: 'column',
          flexShrink: 0,
          listStyle: 'none',
          margin: 0,
          minHeight: 0,
          minWidth: 0,
          padding: 0,
          position: 'relative',
          textDecoration: 'none',
          zIndex: 0,
        },
        inline: { display: 'inline-flex' },
      })
      const Tr = Er
      function Rr({ colors: t, locations: n, start: a, end: l, ...i }) {
        const [{ height: s, width: u }, c] = o.useState({ height: 1, width: 1 }),
          d = o.useMemo(
            () =>
              (function (e, t, n, o, a = 1, l = 1) {
                const i = (function (e, t) {
                  return e.map((e, n) => {
                    const o = (0, r.normalizeColor)(e)
                    return t && t[n] ? `${o} ${100 * Math.max(0, Math.min(1, t[n]))}%` : o
                  })
                })(e, t)
                return `linear-gradient(${(function (e, t, n, r) {
                  const [o, a] = (() => {
                    let e = [0, 0]
                    Array.isArray(n) && (e = [null != n[0] ? n[0] : 0, null != n[1] ? n[1] : 0])
                    let t = [0, 1]
                    return (
                      Array.isArray(r) && (t = [null != r[0] ? r[0] : 0, null != r[1] ? r[1] : 1]),
                      [e, t]
                    )
                  })()
                  ;((o[0] *= e), (a[0] *= e), (o[1] *= t), (a[1] *= t))
                  const l = a[1] - o[1],
                    i = a[0] - o[0]
                  return 90 + (180 * Math.atan2(l, i)) / Math.PI
                })(a, l, n, o)}deg, ${i.join(', ')})`
              })(
                t,
                n,
                a ? (Array.isArray(a) ? a : [a.x, a.y]) : void 0,
                l ? (Array.isArray(l) ? l : [l.x, l.y]) : void 0,
                u,
                s
              ),
            [t, n, a, l, u, s]
          )
        return (0, e.jsx)(Tr, {
          ...i,
          style: [i.style, { backgroundImage: d }],
          onLayout: (e) => {
            const { width: t, height: n } = e.nativeEvent.layout
            ;(c((e) => (t !== e.width || n !== e.height ? { height: n, width: t } : e)),
              i.onLayout && i.onLayout(e))
          },
        })
      }
      const Nr = (0, r.styled)(f, {
          name: 'LinearGradient',
          overflow: 'hidden',
          position: 'relative',
        }),
        Mr = Nr.styleable((t, n) => {
          const o = (0, r.useProps)(t),
            { start: a, end: l, colors: i, locations: s, children: u, ...c } = o,
            d = (0, r.useTheme)()
          let f = o.colors?.map((e) => d[e]?.get('web') ?? e) || []
          return (0, e.jsxs)(Nr, {
            ref: n,
            ...c,
            children: [(0, e.jsx)(Rr, { start: a, end: l, colors: f, locations: s, style: Ar }), u],
          })
        }),
        Ar = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
        Dr = {
          text: 'textAlign',
          b: 'bottom',
          bg: 'backgroundColor',
          content: 'alignContent',
          grow: 'flexGrow',
          items: 'alignItems',
          justify: 'justifyContent',
          l: 'left',
          m: 'margin',
          maxH: 'maxHeight',
          maxW: 'maxWidth',
          mb: 'marginBottom',
          minH: 'minHeight',
          minW: 'minWidth',
          ml: 'marginLeft',
          mr: 'marginRight',
          mt: 'marginTop',
          mx: 'marginHorizontal',
          my: 'marginVertical',
          p: 'padding',
          pb: 'paddingBottom',
          pl: 'paddingLeft',
          pr: 'paddingRight',
          pt: 'paddingTop',
          px: 'paddingHorizontal',
          py: 'paddingVertical',
          r: 'right',
          rounded: 'borderRadius',
          select: 'userSelect',
          self: 'alignSelf',
          shrink: 'flexShrink',
          t: 'top',
          z: 'zIndex',
        }
      Object.assign(
        Dr,
        Object.fromEntries([
          ['fwr', 'flexWrap'],
          ['col', 'color'],
          ['ff', 'fontFamily'],
          ['fst', 'fontStyle'],
          ['tt', 'textTransform'],
          ['td', 'textDecorationLine'],
          ['va', 'verticalAlign'],
          ['ws', 'whiteSpace'],
          ['wb', 'wordBreak'],
          ['ww', 'wordWrap'],
          ['brc', 'borderRightColor'],
          ['brw', 'borderRightWidth'],
          ['bs', 'borderStyle'],
          ['btc', 'borderTopColor'],
          ['btlr', 'borderTopLeftRadius'],
          ['btrr', 'borderTopRightRadius'],
          ['btw', 'borderTopWidth'],
          ['bw', 'borderWidth'],
          ['o', 'opacity'],
          ['cur', 'cursor'],
          ['pe', 'pointerEvents'],
          ['ov', 'overflow'],
          ['pos', 'position'],
          ['dsp', 'display'],
          ['fw', 'fontWeight'],
          ['fs', 'fontSize'],
          ['ls', 'letterSpacing'],
          ['lh', 'lineHeight'],
          ['bxs', 'boxSizing'],
          ['bxsh', 'boxShadow'],
          ['ox', 'overflowX'],
          ['oy', 'overflowY'],
        ])
      )
      const zr = {
          blue1: 'hsl(206, 100%, 99.2%)',
          blue2: 'hsl(210, 100%, 98.0%)',
          blue3: 'hsl(209, 100%, 96.5%)',
          blue4: 'hsl(210, 98.8%, 94.0%)',
          blue5: 'hsl(209, 95.0%, 90.1%)',
          blue6: 'hsl(209, 81.2%, 84.5%)',
          blue7: 'hsl(208, 77.5%, 76.9%)',
          blue8: 'hsl(206, 81.9%, 65.3%)',
          blue9: 'hsl(206, 100%, 50.0%)',
          blue10: 'hsl(208, 100%, 47.3%)',
          blue11: 'hsl(211, 100%, 43.2%)',
          blue12: 'hsl(211, 100%, 15.0%)',
        },
        Ir = {
          green1: 'hsl(136, 50.0%, 98.9%)',
          green2: 'hsl(138, 62.5%, 96.9%)',
          green3: 'hsl(139, 55.2%, 94.5%)',
          green4: 'hsl(140, 48.7%, 91.0%)',
          green5: 'hsl(141, 43.7%, 86.0%)',
          green6: 'hsl(143, 40.3%, 79.0%)',
          green7: 'hsl(146, 38.5%, 69.0%)',
          green8: 'hsl(151, 40.2%, 54.1%)',
          green9: 'hsl(151, 55.0%, 41.5%)',
          green10: 'hsl(152, 57.5%, 37.6%)',
          green11: 'hsl(153, 67.0%, 28.5%)',
          green12: 'hsl(155, 40.0%, 14.0%)',
        },
        $r = {
          red1: 'hsl(359, 100%, 99.4%)',
          red2: 'hsl(359, 100%, 98.6%)',
          red3: 'hsl(360, 100%, 96.8%)',
          red4: 'hsl(360, 97.9%, 94.8%)',
          red5: 'hsl(360, 90.2%, 91.9%)',
          red6: 'hsl(360, 81.7%, 87.8%)',
          red7: 'hsl(359, 74.2%, 81.7%)',
          red8: 'hsl(359, 69.5%, 74.3%)',
          red9: 'hsl(358, 75.0%, 59.0%)',
          red10: 'hsl(358, 69.4%, 55.2%)',
          red11: 'hsl(358, 65.0%, 48.7%)',
          red12: 'hsl(354, 50.0%, 14.6%)',
        },
        Lr = {
          yellow1: 'hsl(60, 54.0%, 98.5%)',
          yellow2: 'hsl(52, 100%, 95.5%)',
          yellow3: 'hsl(55, 100%, 90.9%)',
          yellow4: 'hsl(54, 100%, 86.6%)',
          yellow5: 'hsl(52, 97.9%, 82.0%)',
          yellow6: 'hsl(50, 89.4%, 76.1%)',
          yellow7: 'hsl(47, 80.4%, 68.0%)',
          yellow8: 'hsl(48, 100%, 46.1%)',
          yellow9: 'hsl(53, 92.0%, 50.0%)',
          yellow10: 'hsl(50, 100%, 48.5%)',
          yellow11: 'hsl(42, 100%, 29.0%)',
          yellow12: 'hsl(40, 55.0%, 13.5%)',
        },
        Fr = {
          blue1: 'hsl(212, 35.0%, 9.2%)',
          blue2: 'hsl(216, 50.0%, 11.8%)',
          blue3: 'hsl(214, 59.4%, 15.3%)',
          blue4: 'hsl(214, 65.8%, 17.9%)',
          blue5: 'hsl(213, 71.2%, 20.2%)',
          blue6: 'hsl(212, 77.4%, 23.1%)',
          blue7: 'hsl(211, 85.1%, 27.4%)',
          blue8: 'hsl(211, 89.7%, 34.1%)',
          blue9: 'hsl(206, 100%, 50.0%)',
          blue10: 'hsl(209, 100%, 60.6%)',
          blue11: 'hsl(210, 100%, 66.1%)',
          blue12: 'hsl(206, 98.0%, 95.8%)',
        },
        Vr = {
          green1: 'hsl(146, 30.0%, 7.4%)',
          green2: 'hsl(155, 44.2%, 8.4%)',
          green3: 'hsl(155, 46.7%, 10.9%)',
          green4: 'hsl(154, 48.4%, 12.9%)',
          green5: 'hsl(154, 49.7%, 14.9%)',
          green6: 'hsl(154, 50.9%, 17.6%)',
          green7: 'hsl(153, 51.8%, 21.8%)',
          green8: 'hsl(151, 51.7%, 28.4%)',
          green9: 'hsl(151, 55.0%, 41.5%)',
          green10: 'hsl(151, 49.3%, 46.5%)',
          green11: 'hsl(151, 50.0%, 53.2%)',
          green12: 'hsl(137, 72.0%, 94.0%)',
        },
        Wr = {
          red1: 'hsl(353, 23.0%, 9.8%)',
          red2: 'hsl(357, 34.4%, 12.0%)',
          red3: 'hsl(356, 43.4%, 16.4%)',
          red4: 'hsl(356, 47.6%, 19.2%)',
          red5: 'hsl(356, 51.1%, 21.9%)',
          red6: 'hsl(356, 55.2%, 25.9%)',
          red7: 'hsl(357, 60.2%, 31.8%)',
          red8: 'hsl(358, 65.0%, 40.4%)',
          red9: 'hsl(358, 75.0%, 59.0%)',
          red10: 'hsl(358, 85.3%, 64.0%)',
          red11: 'hsl(358, 100%, 69.5%)',
          red12: 'hsl(351, 89.0%, 96.0%)',
        },
        Br = {
          yellow1: 'hsl(45, 100%, 5.5%)',
          yellow2: 'hsl(46, 100%, 6.7%)',
          yellow3: 'hsl(45, 100%, 8.7%)',
          yellow4: 'hsl(45, 100%, 10.4%)',
          yellow5: 'hsl(47, 100%, 12.1%)',
          yellow6: 'hsl(49, 100%, 14.3%)',
          yellow7: 'hsl(49, 90.3%, 18.4%)',
          yellow8: 'hsl(50, 100%, 22.0%)',
          yellow9: 'hsl(53, 92.0%, 50.0%)',
          yellow10: 'hsl(54, 100%, 68.0%)',
          yellow11: 'hsl(48, 100%, 47.0%)',
          yellow12: 'hsl(53, 100%, 91.0%)',
        }
      function Hr(e, t, n) {
        return Math.min(Math.max(e, n), t)
      }
      class Ur extends Error {
        constructor(e) {
          super(`Failed to parse color: "${e}"`)
        }
      }
      var Gr = Ur
      const qr = (e) => parseInt(e.replace(/_/g, ''), 36),
        Xr =
          '1q29ehhb 1n09sgk7 1kl1ekf_ _yl4zsno 16z9eiv3 1p29lhp8 _bd9zg04 17u0____ _iw9zhe5 _to73___ _r45e31e _7l6g016 _jh8ouiv _zn3qba8 1jy4zshs 11u87k0u 1ro9yvyo 1aj3xael 1gz9zjz0 _3w8l4xo 1bf1ekf_ _ke3v___ _4rrkb__ 13j776yz _646mbhl _nrjr4__ _le6mbhl 1n37ehkb _m75f91n _qj3bzfz 1939yygw 11i5z6x8 _1k5f8xs 1509441m 15t5lwgf _ae2th1n _tg1ugcv 1lp1ugcv 16e14up_ _h55rw7n _ny9yavn _7a11xb_ 1ih442g9 _pv442g9 1mv16xof 14e6y7tu 1oo9zkds 17d1cisi _4v9y70f _y98m8kc 1019pq0v 12o9zda8 _348j4f4 1et50i2o _8epa8__ _ts6senj 1o350i2o 1mi9eiuo 1259yrp0 1ln80gnw _632xcoy 1cn9zldc _f29edu4 1n490c8q _9f9ziet 1b94vk74 _m49zkct 1kz6s73a 1eu9dtog _q58s1rz 1dy9sjiq __u89jo3 _aj5nkwg _ld89jo3 13h9z6wx _qa9z2ii _l119xgq _bs5arju 1hj4nwk9 1qt4nwk9 1ge6wau6 14j9zlcw 11p1edc_ _ms1zcxe _439shk6 _jt9y70f _754zsow 1la40eju _oq5p___ _x279qkz 1fa5r3rv _yd2d9ip _424tcku _8y1di2_ _zi2uabw _yy7rn9h 12yz980_ __39ljp6 1b59zg0x _n39zfzp 1fy9zest _b33k___ _hp9wq92 1il50hz4 _io472ub _lj9z3eo 19z9ykg0 _8t8iu3a 12b9bl4a 1ak5yw0o _896v4ku _tb8k8lv _s59zi6t _c09ze0p 1lg80oqn 1id9z8wb _238nba5 1kq6wgdi _154zssg _tn3zk49 _da9y6tc 1sg7cv4f _r12jvtt 1gq5fmkz 1cs9rvci _lp9jn1c _xw1tdnb 13f9zje6 16f6973h _vo7ir40 _bt5arjf _rc45e4t _hr4e100 10v4e100 _hc9zke2 _w91egv_ _sj2r1kk 13c87yx8 _vqpds__ _ni8ggk8 _tj9yqfb 1ia2j4r4 _7x9b10u 1fc9ld4j 1eq9zldr _5j9lhpx _ez9zl6o _md61fzm'
            .split(' ')
            .reduce((e, t) => {
              const n = qr(t.substring(0, 3)),
                r = qr(t.substring(3)).toString(16)
              let o = ''
              for (let e = 0; e < 6 - r.length; e++) o += '0'
              return ((e[n] = `${o}${r}`), e)
            }, {}),
        Yr = (e, t) =>
          Array.from(Array(t))
            .map(() => e)
            .join(''),
        Kr = new RegExp(`^#${Yr('([a-f0-9])', 3)}([a-f0-9])?$`, 'i'),
        Qr = new RegExp(`^#${Yr('([a-f0-9]{2})', 3)}([a-f0-9]{2})?$`, 'i'),
        Zr = new RegExp(
          `^rgba?\\(\\s*(\\d+)\\s*${Yr(',\\s*(\\d+)\\s*', 2)}(?:,\\s*([\\d.]+))?\\s*\\)$`,
          'i'
        ),
        Jr = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i,
        eo = /^[a-z]+$/i,
        to = (e) => Math.round(255 * e),
        no = (e, t, n) => {
          let r = n / 100
          if (0 === t) return [r, r, r].map(to)
          const o = (((e % 360) + 360) % 360) / 60,
            a = (1 - Math.abs(2 * r - 1)) * (t / 100),
            l = a * (1 - Math.abs((o % 2) - 1))
          let i = 0,
            s = 0,
            u = 0
          o >= 0 && o < 1
            ? ((i = a), (s = l))
            : o >= 1 && o < 2
              ? ((i = l), (s = a))
              : o >= 2 && o < 3
                ? ((s = a), (u = l))
                : o >= 3 && o < 4
                  ? ((s = l), (u = a))
                  : o >= 4 && o < 5
                    ? ((i = l), (u = a))
                    : o >= 5 && o < 6 && ((i = a), (u = l))
          const c = r - a / 2
          return [i + c, s + c, u + c].map(to)
        }
      function ro(e) {
        const [t, n, r, o] = (function (e) {
            if ('string' != typeof e) throw new Gr(e)
            if ('transparent' === e.trim().toLowerCase()) return [0, 0, 0, 0]
            let t = e.trim()
            t = eo.test(e)
              ? (function (e) {
                  const t = e.toLowerCase().trim(),
                    n =
                      Xr[
                        (function (e) {
                          let t = 5381,
                            n = e.length
                          for (; n; ) t = (33 * t) ^ e.charCodeAt(--n)
                          return (t >>> 0) % 2341
                        })(t)
                      ]
                  if (!n) throw new Gr(e)
                  return `#${n}`
                })(e)
              : e
            const n = Kr.exec(t)
            if (n) {
              const e = Array.from(n).slice(1)
              return [
                ...e.slice(0, 3).map((e) => parseInt(Yr(e, 2), 16)),
                parseInt(Yr(e[3] || 'f', 2), 16) / 255,
              ]
            }
            const r = Qr.exec(t)
            if (r) {
              const e = Array.from(r).slice(1)
              return [
                ...e.slice(0, 3).map((e) => parseInt(e, 16)),
                parseInt(e[3] || 'ff', 16) / 255,
              ]
            }
            const o = Zr.exec(t)
            if (o) {
              const e = Array.from(o).slice(1)
              return [...e.slice(0, 3).map((e) => parseInt(e, 10)), parseFloat(e[3] || '1')]
            }
            const a = Jr.exec(t)
            if (a) {
              const [t, n, r, o] = Array.from(a).slice(1).map(parseFloat)
              if (Hr(0, 100, n) !== n) throw new Gr(e)
              if (Hr(0, 100, r) !== r) throw new Gr(e)
              return [...no(t, n, r), Number.isNaN(o) ? 1 : o]
            }
            throw new Gr(e)
          })(e).map((e, t) => (3 === t ? e : e / 255)),
          a = Math.max(t, n, r),
          l = Math.min(t, n, r),
          i = (a + l) / 2
        if (a === l) return [0, 0, i, o]
        const s = a - l
        return [
          60 *
            (t === a ? (n - r) / s + (n < r ? 6 : 0) : n === a ? (r - t) / s + 2 : (t - n) / s + 4),
          i > 0.5 ? s / (2 - a - l) : s / (a + l),
          i,
          o,
        ]
      }
      function oo(e, t, n, r) {
        return `hsla(${(e % 360).toFixed()}, ${Hr(0, 100, 100 * t).toFixed()}%, ${Hr(0, 100, 100 * n).toFixed()}%, ${parseFloat(Hr(0, 1, r).toFixed(3))})`
      }
      const ao = {
          ListItem: { template: 'surface1' },
          SelectTrigger: { template: 'surface1' },
          Card: { template: 'surface1' },
          Button: { template: 'surface3' },
          Checkbox: { template: 'surface2' },
          Switch: { template: 'surface2' },
          SwitchThumb: { template: 'inverse' },
          TooltipContent: { template: 'surface2' },
          Progress: { template: 'surface1' },
          RadioGroupItem: { template: 'surface2' },
          TooltipArrow: { template: 'surface1' },
          SliderTrackActive: { template: 'surface3' },
          SliderTrack: { template: 'surface1' },
          SliderThumb: { template: 'inverse' },
          Tooltip: { template: 'inverse' },
          ProgressIndicator: { template: 'inverse' },
          Input: { template: 'surface1' },
          TextArea: { template: 'surface1' },
        },
        lo = (e) => Object.keys(e)
      function io(e) {
        return Object.fromEntries(e)
      }
      const so = (e) => {
          const t = 'light' === e ? -1 : 1,
            n = -t,
            r = {
              color: -6,
              colorHover: -7,
              colorPress: -6,
              colorFocus: -7,
              placeholderColor: -9,
              outlineColor: -2,
            },
            o = {
              accentBackground: 0,
              accentColor: -0,
              background0: 1,
              background02: 2,
              background04: 3,
              background06: 4,
              background08: 5,
              color1: 6,
              color2: 7,
              color3: 8,
              color4: 9,
              color5: 10,
              color6: 11,
              color7: 12,
              color8: 13,
              color9: 14,
              color10: 15,
              color11: 16,
              color12: 17,
              color0: -1,
              color02: -2,
              color04: -3,
              color06: -4,
              color08: -5,
              background: 6,
              backgroundHover: 6 + t,
              backgroundPress: 6 + n,
              backgroundFocus: 6 + n,
              borderColor: 9,
              borderColorHover: 9 + t,
              borderColorPress: 9 + n,
              borderColorFocus: 9,
              ...r,
              colorTransparent: -1,
            }
          return {
            base: o,
            surface1: {
              ...r,
              background: o.background + 1,
              backgroundHover: o.backgroundHover + 1,
              backgroundPress: o.backgroundPress + 1,
              backgroundFocus: o.backgroundFocus + 1,
              borderColor: o.borderColor + 1,
              borderColorHover: o.borderColorHover + 1,
              borderColorFocus: o.borderColorFocus + 1,
              borderColorPress: o.borderColorPress + 1,
            },
            surface2: {
              ...r,
              background: o.background + 2,
              backgroundHover: o.backgroundHover + 2,
              backgroundPress: o.backgroundPress + 2,
              backgroundFocus: o.backgroundFocus + 2,
              borderColor: o.borderColor + 2,
              borderColorHover: o.borderColorHover + 2,
              borderColorFocus: o.borderColorFocus + 2,
              borderColorPress: o.borderColorPress + 2,
            },
            surface3: {
              ...r,
              background: o.background + 3,
              backgroundHover: o.backgroundHover + 3,
              backgroundPress: o.backgroundPress + 3,
              backgroundFocus: o.backgroundFocus + 3,
              borderColor: o.borderColor + 3,
              borderColorHover: o.borderColorHover + 3,
              borderColorFocus: o.borderColorFocus + 3,
              borderColorPress: o.borderColorPress + 3,
            },
            alt1: {
              color: o.color - 1,
              colorHover: o.colorHover - 1,
              colorPress: o.colorPress - 1,
              colorFocus: o.colorFocus - 1,
            },
            alt2: {
              color: o.color - 2,
              colorHover: o.colorHover - 2,
              colorPress: o.colorPress - 2,
              colorFocus: o.colorFocus - 2,
            },
            inverse: Object.fromEntries(Object.entries(o).map(([e, t]) => [e, -t])),
          }
        },
        uo = (() => {
          const e = so('light'),
            t = so('dark')
          return {
            ...io(lo(e).map((t) => [`light_${t}`, e[t]])),
            ...io(lo(t).map((e) => [`dark_${e}`, t[e]])),
          }
        })(),
        co = ({ palette: e, scheme: t }) => {
          if (!e) return []
          const { anchors: n } = e
          let r = []
          const o = (e, t, n) => {
              r.push(oo(e, t, n, 1))
            },
            a = Object.keys(n).length
          for (const [e, l] of n.entries()) {
            const [i, s, u] = [l.hue[t], l.sat[t], l.lum[t]]
            if (0 !== e) {
              const r = n[e - 1],
                a = l.index - r.index,
                c = (r.hue[t] - i) / a,
                d = (r.sat[t] - s) / a,
                f = (r.lum[t] - u) / a
              for (let e = r.index + 1; e < l.index; e++) {
                const t = l.index - e
                o(i + c * t, s + d * t, u + f * t)
              }
            }
            if ((o(i, s, u), e === a - 1 && r.length < 12))
              for (let e = l.index + 1; e < 12; e++) o(i, s, u)
          }
          const l = [r[0], r[r.length - 1]].map((e) => {
              const [t, n, r] = ro(e)
              return [
                oo(t, n, r, 0),
                oo(t, n, r, 0.2),
                oo(t, n, r, 0.4),
                oo(t, n, r, 0.6),
                oo(t, n, r, 0.8),
              ]
            }),
            i = [...l[1]].reverse()
          return ((r = [...l[0], ...r, ...i]), r)
        }
      function fo(e) {
        return {
          light: co({ palette: e, scheme: 'light' }),
          dark: co({ palette: e, scheme: 'dark' }),
        }
      }
      function po(e) {
        return Object.entries(e)
      }
      function mo(e) {
        return Object.fromEntries(e)
      }
      function bo(e) {
        return 1 / e === Number.NEGATIVE_INFINITY
      }
      const ho = (e) => ('function' == typeof e ? { name: e.name || 'unnamed', mask: e } : e),
        go = (e, t) => {
          const { skip: n } = t
          return Object.fromEntries(
            Object.entries(e)
              .filter(([e]) => !n || !(e in n))
              .map(([e, n]) => [e, yo(e, n, t)])
          )
        }
      function yo(e, t, n) {
        let r,
          o = n.overrideStrategy
        const a = n.overrideSwap?.[e]
        if (typeof a < 'u') ((r = a), (o = 'swap'))
        else {
          const t = n.overrideShift?.[e]
          if (typeof t < 'u') ((r = t), (o = 'shift'))
          else {
            const t = n.override?.[e]
            typeof t < 'u' && ((r = t), (o = n.overrideStrategy))
          }
        }
        return typeof r > 'u' || 'string' == typeof r ? t : 'swap' === o ? r : t
      }
      const vo = () => ({
          name: 'inverse-mask',
          mask: (e, t) => {
            const n = mo(po(e).map(([e, t]) => [e, -t]))
            return go(n, t)
          },
        }),
        So = ({ inverse: e } = {}, t) => ({
          name: 'shift-mask',
          mask: (n, r) => {
            const {
                override: o,
                overrideStrategy: a = 'shift',
                max: l,
                palette: i,
                min: s = 0,
                strength: u = 1,
              } = { ...t, ...r },
              c = Object.entries(n),
              d = l ?? (i ? Object.values(i).length - 1 : Number.POSITIVE_INFINITY),
              f = {}
            for (const [t, n] of c) {
              if ('string' == typeof n) continue
              if ('number' == typeof o?.[t]) {
                const e = o[t]
                f[t] = 'shift' === a ? n + e : e
                continue
              }
              if ('string' == typeof o?.[t]) {
                f[t] = o[t]
                continue
              }
              const r = 0 === n ? !bo(n) : n >= 0,
                l = n + u * (r ? 1 : -1) * (e ? -1 : 1),
                i = r ? Math.max(s, Math.min(d, l)) : Math.min(-s, Math.max(-d, l))
              f[t] = i
            }
            return go(f, r)
          },
        }),
        wo = (e) => ({ name: 'soften-mask', mask: So({}, e).mask }),
        Oo = (e) => ({ name: 'strengthen-mask', mask: So({ inverse: !0 }, e).mask }),
        ko = new Map(),
        xo = (e, t) => ko.get(t || JSON.stringify(e)),
        Po = (e, t) => {
          const n = { ...t, cache: new Map() }
          ;(ko.set(t.name || JSON.stringify(e), n), ko.set(JSON.stringify(t.definition), n))
        },
        _o = new Map()
      function Co(e, t, n, r, o, a = !1) {
        if (!e[t]) throw new Error(`No pallete: ${t}`)
        const l = { ...n }
        for (const r in n) {
          let o = n[r]
          if ('string' == typeof o && '$' === o[0]) {
            const [n, a] = o.split('.'),
              i = n.slice(1),
              s = t.split('_')[0],
              u = e[i] || e[`${s}_${i}`]
            if (u) {
              const e = jo(u, +a)
              typeof e < 'u' && (l[r] = e)
            }
          }
        }
        return Eo(e[t], l, r, o, a)
      }
      function Eo(e, t, n, r, o = !1) {
        const a = o ? '' : JSON.stringify([r, e, t, n])
        if (!o && _o.has(a)) return _o.get(a)
        const l = {
          ...Object.fromEntries(Object.entries(t).map(([t, n]) => [t, jo(e, n)])),
          ...n?.nonInheritedValues,
        }
        return (Po(l, { palette: e, definition: t, options: n, name: r }), a && _o.set(a, l), l)
      }
      const jo = (e, t) => {
        if (!e) throw new Error('No palette!')
        if ('string' == typeof t) return t
        const n = e.length - 1,
          r = (0 === t ? !bo(t) : t >= 0) ? t : n + t
        return e[Math.min(Math.max(0, r), n)]
      }
      function To(e, t, n = {}, r, o) {
        const a = xo(e, r)
        if (!a) throw new Error('❌ Err2')
        const l = Ro(a, t, n, r)
        return (Po(l.theme, { definition: l.definition, palette: a.palette, name: o }), l.theme)
      }
      function Ro(e, t, n = {}, r) {
        const o = { ...n.skip }
        if (e.options?.nonInheritedValues) for (const t in e.options.nonInheritedValues) o[t] = 1
        const a = { parentName: r, palette: e.palette, ...n, skip: o },
          l = t.mask(e.definition, a),
          i = Eo(e.palette, l)
        return { ...e, cache: new Map(), definition: l, theme: i }
      }
      class No {
        constructor(e) {
          this.state = e
        }
        addPalettes(e) {
          return ((this.state.palettes = { ...this.state.palettes, ...e }), this)
        }
        addTemplates(e) {
          return ((this.state.templates = { ...this.state.templates, ...e }), this)
        }
        addMasks(e) {
          return (
            (this.state.masks = { ...this.state.masks, ...mo(po(e).map(([e, t]) => [e, ho(t)])) }),
            this
          )
        }
        _addedThemes = []
        addThemes(e) {
          return (
            this._addedThemes.push({ type: 'themes', args: [e] }),
            (this.state.themes = { ...this.state.themes, ...e }),
            this
          )
        }
        addComponentThemes(e, t) {
          return (this.addChildThemes(e, t), this)
        }
        addChildThemes(e, t) {
          const n = this.state.themes
          if (!n)
            throw new Error('No themes defined yet, use addThemes first to set your base themes')
          this._addedThemes.push({ type: 'childThemes', args: [e, t] })
          const r = Object.keys(n),
            o = Object.keys(e),
            a = r.flatMap((n) => {
              const r = t?.avoidNestingWithin
              return r && r.some((e) => n.startsWith(e) || n.endsWith(e))
                ? []
                : o
                    .map((t) => {
                      const r = `${n}_${t}`,
                        o = e[t]
                      return 'avoidNestingWithin' in o &&
                        o.avoidNestingWithin.some((e) => n.startsWith(e) || n.endsWith(e))
                        ? null
                        : [r, o]
                    })
                    .filter(Boolean)
            }),
            l = Object.fromEntries(a),
            i = { ...this.state.themes, ...l }
          return ((this.state.themes = i), this)
        }
        build() {
          if (!this.state.themes) return {}
          const e = {},
            t = []
          for (const n in this.state.themes) {
            const r = n.split('_'),
              o = r.slice(0, r.length - 1).join('_'),
              a = this.state.themes[n],
              l = Array.isArray(a)
                ? a.find((e) => !e.parent || o.endsWith(e.parent) || o.startsWith(e.parent)) || null
                : a
            if (l)
              if ('theme' in l) e[n] = l.theme
              else if ('mask' in l) t.push({ parentName: o, themeName: n, mask: l })
              else {
                let { palette: t = '', template: a, ...i } = l
                if ((this.state.themes[o], !this.state.palettes))
                  throw new Error(`No palettes defined for theme with palette expected: ${n}`)
                let s = this.state.palettes[t || ''],
                  u = `${o}_${t}`
                for (; !s && u; )
                  u in this.state.palettes
                    ? ((s = this.state.palettes[u]), (t = u))
                    : (u = u.split('_').slice(0, -1).join('_'))
                if (!s) throw new Error('No palette for theme')
                const c = this.state.templates?.[a] ?? this.state.templates?.[`${r[0]}_${a}`]
                if (!c)
                  throw new Error(
                    `No template for theme ${n}: ${a} in templates:\n- ${Object.keys(this.state.templates || {}).join('\n - ')}`
                  )
                e[n] = Co(this.state.palettes, t, c, i, n, !0)
              }
          }
          for (const { mask: n, themeName: r, parentName: o } of t) {
            const t = e[o]
            if (!t) continue
            const { mask: a, ...l } = n
            let i = this.state.masks?.[a]
            if (!i) throw new Error(`No mask ${a}`)
            const s = this.state.themes[o]
            if (s && 'childOptions' in s) {
              const { mask: e, ...t } = s.childOptions
              ;(e && (i = this.state.masks?.[e]), Object.assign(l, t))
            }
            e[r] = To(t, i, l, o, r)
          }
          return e
        }
      }
      let Mo = null
      function Ao(e) {
        return Object.fromEntries(
          Object.entries(e || {}).map(([e, t]) => [
            e,
            { palette: e, template: t.template || 'base' },
          ])
        )
      }
      const Do = Fo(
        Lo({ base: { palette: ['#fff', '#000'] }, accent: { palette: ['#ff0000', '#ff9999'] } })
      )
      function zo(e) {
        const t = e.light.length
        return e.light.map((n, r) => {
          const o = e.dark[r],
            [a, l, i] = ro(n),
            [s, u, c] = ro(o)
          return {
            index: Io(11, t, r),
            hue: { light: a, dark: s },
            sat: { light: l, dark: u },
            lum: { light: i, dark: c },
          }
        })
      }
      function Io(e, t, n) {
        return Math.round((n / (t - 1)) * e)
      }
      function $o(e) {
        return Array.isArray(e) ? { light: (t = e), dark: [...t].reverse() } : e
        var t
      }
      function Lo(e) {
        const t = $o(e.base.palette),
          n = e.accent ? $o(e.accent.palette) : null,
          r = zo(t)
        function o(e) {
          return Object.fromEntries(
            Object.entries(e).map(([e, t]) => [
              e,
              { name: e, anchors: t.palette ? zo($o(t.palette)) : r },
            ])
          )
        }
        return {
          base: { name: 'base', anchors: r },
          ...(n && { accent: { name: 'accent', anchors: zo(n) } }),
          ...(e.childrenThemes && o(e.childrenThemes)),
          ...(e.grandChildrenThemes && o(e.grandChildrenThemes)),
        }
      }
      function Fo(e) {
        const t = e.accent ? fo(e.accent) : null,
          n = fo(e.base)
        return Object.fromEntries(
          Object.entries(e).flatMap(([e, r]) => {
            const o = fo(r),
              a = e.startsWith('accent') ? n : t || n
            if (!a) return []
            const l = a.light,
              i = a.dark
            return [
              ['base' === e ? 'light' : `light_${e}`, [l[7], ...o.light, l[l.length - 7 - 1]]],
              ['base' === e ? 'dark' : `dark_${e}`, [i[i.length - 7 - 1], ...o.dark, i[7]]],
            ]
          })
        )
      }
      const Vo = (e) => {
          const t = 'light' === e ? -1 : 1,
            n = -t,
            r = {
              color: -6,
              colorHover: -7,
              colorPress: -6,
              colorFocus: -7,
              placeholderColor: -9,
              outlineColor: -2,
            },
            o = {
              accentBackground: 0,
              accentColor: -0,
              background0: 1,
              background02: 2,
              background04: 3,
              background06: 4,
              background08: 5,
              color1: 6,
              color2: 7,
              color3: 8,
              color4: 9,
              color5: 10,
              color6: 11,
              color7: 12,
              color8: 13,
              color9: 14,
              color10: 15,
              color11: 16,
              color12: 17,
              color0: -1,
              color02: -2,
              color04: -3,
              color06: -4,
              color08: -5,
              background: 6,
              backgroundHover: 6 + t,
              backgroundPress: 6 + n,
              backgroundFocus: 6 + n,
              borderColor: 9,
              borderColorHover: 9 + t,
              borderColorPress: 9 + n,
              borderColorFocus: 9,
              ...r,
              colorTransparent: -1,
            }
          return {
            base: o,
            surface1: {
              ...r,
              background: o.background + 2,
              backgroundHover: o.backgroundHover + 2,
              backgroundPress: o.backgroundPress + 2,
              backgroundFocus: o.backgroundFocus + 2,
              borderColor: o.borderColor + 2,
              borderColorHover: o.borderColorHover + 2,
              borderColorFocus: o.borderColorFocus + 2,
              borderColorPress: o.borderColorPress + 2,
            },
            surface2: {
              ...r,
              background: o.background + 3,
              backgroundHover: o.backgroundHover + 3,
              backgroundPress: o.backgroundPress + 3,
              backgroundFocus: o.backgroundFocus + 3,
              borderColor: o.borderColor + 3,
              borderColorHover: o.borderColorHover + 3,
              borderColorFocus: o.borderColorFocus + 3,
              borderColorPress: o.borderColorPress + 3,
            },
            surface3: {
              ...r,
              background: o.background + 4,
              backgroundHover: o.backgroundHover + 4,
              backgroundPress: o.backgroundPress + 4,
              backgroundFocus: o.backgroundFocus + 4,
              borderColor: o.borderColor + 4,
              borderColorHover: o.borderColorHover + 4,
              borderColorFocus: o.borderColorFocus + 4,
              borderColorPress: o.borderColorPress + 4,
            },
            alt1: {
              color: o.color - 1,
              colorHover: o.colorHover - 1,
              colorPress: o.colorPress - 1,
              colorFocus: o.colorFocus - 1,
            },
            alt2: {
              color: o.color - 2,
              colorHover: o.colorHover - 2,
              colorPress: o.colorPress - 2,
              colorFocus: o.colorFocus - 2,
            },
            inverse: Object.fromEntries(Object.entries(o).map(([e, t]) => [e, -t])),
          }
        },
        Wo =
          ((() => {
            const e = Vo('light'),
              t = Vo('dark')
            ;(io(lo(e).map((t) => [`light_${t}`, e[t]])), io(lo(t).map((e) => [`dark_${e}`, t[e]])))
          })(),
          (e) => {
            const t = 'light' === e ? -1 : 1,
              n = -t,
              r = {
                color: -6,
                colorHover: -7,
                colorPress: -6,
                colorFocus: -7,
                placeholderColor: -9,
                outlineColor: -2,
              },
              o = {
                accentBackground: 0,
                accentColor: -0,
                background0: 1,
                background02: 2,
                background04: 3,
                background06: 4,
                background08: 5,
                color1: 6,
                color2: 7,
                color3: 8,
                color4: 9,
                color5: 10,
                color6: 11,
                color7: 12,
                color8: 13,
                color9: 14,
                color10: 15,
                color11: 16,
                color12: 17,
                color0: -1,
                color02: -2,
                color04: -3,
                color06: -4,
                color08: -5,
                background: 6,
                backgroundHover: 6 + t,
                backgroundPress: 6 + n,
                backgroundFocus: 6 + n,
                borderColor: 9,
                borderColorHover: 9 + t,
                borderColorPress: 9 + n,
                borderColorFocus: 9,
                ...r,
                colorTransparent: -1,
              }
            return {
              base: o,
              surface1: {
                ...r,
                background: o.background + 3,
                backgroundHover: o.backgroundHover + 3,
                backgroundPress: o.backgroundPress + 3,
                backgroundFocus: o.backgroundFocus + 3,
                borderColor: o.borderColor + 3,
                borderColorHover: o.borderColorHover + 3,
                borderColorFocus: o.borderColorFocus + 3,
                borderColorPress: o.borderColorPress + 3,
              },
              surface2: {
                ...r,
                background: o.background + 4,
                backgroundHover: o.backgroundHover + 4,
                backgroundPress: o.backgroundPress + 4,
                backgroundFocus: o.backgroundFocus + 4,
                borderColor: o.borderColor + 4,
                borderColorHover: o.borderColorHover + 4,
                borderColorFocus: o.borderColorFocus + 4,
                borderColorPress: o.borderColorPress + 4,
              },
              surface3: {
                ...r,
                background: o.background + 5,
                backgroundHover: o.backgroundHover + 5,
                backgroundPress: o.backgroundPress + 5,
                backgroundFocus: o.backgroundFocus + 5,
                borderColor: o.borderColor + 5,
                borderColorHover: o.borderColorHover + 5,
                borderColorFocus: o.borderColorFocus + 5,
                borderColorPress: o.borderColorPress + 5,
              },
              alt1: {
                color: o.color - 1,
                colorHover: o.colorHover - 1,
                colorPress: o.colorPress - 1,
                colorFocus: o.colorFocus - 1,
              },
              alt2: {
                color: o.color - 2,
                colorHover: o.colorHover - 2,
                colorPress: o.colorPress - 2,
                colorFocus: o.colorFocus - 2,
              },
              inverse: Object.fromEntries(Object.entries(o).map(([e, t]) => [e, -t])),
            }
          })
      ;(() => {
        const e = Wo('light'),
          t = Wo('dark')
        ;(io(lo(e).map((t) => [`light_${t}`, e[t]])), io(lo(t).map((e) => [`dark_${e}`, t[e]])))
      })()
      const Bo = (...e) => ({
        name: 'combine-mask',
        mask: (t, n) => {
          let r,
            o = xo(t, n.parentName)
          for (const a of e) {
            if (!o)
              throw new Error(
                `Nothing returned from mask: ${o}, for template: ${t} and mask: ${a.toString()}, given opts ${JSON.stringify(n, null, 2)}`
              )
            const e = Ro(o, a, n)
            ;((o = e), (r = e.theme))
          }
          return r
        },
      })
      function Ho(e) {
        return 0 === e
          ? 0
          : 2 === e
            ? 0.5
            : 4 === e
              ? 1
              : 8 === e
                ? 1.5
                : e <= 16
                  ? Math.round(0.333 * e)
                  : Math.floor(0.7 * e - 12)
      }
      ;(wo(),
        wo({ strength: 2 }),
        wo({ strength: 3 }),
        Oo(),
        vo(),
        Bo(vo(), wo({ strength: 2 })),
        Bo(vo(), wo({ strength: 3 })),
        Bo(vo(), wo({ strength: 4 })),
        Bo(vo(), Oo({ strength: 2 })),
        ho((e, t) => {
          const n = Oo().mask(e, t),
            r = wo().mask(e, t)
          return {
            ...n,
            borderColor: r.borderColor,
            borderColorHover: r.borderColorHover,
            borderColorPress: r.borderColorPress,
            borderColorFocus: r.borderColorFocus,
          }
        }),
        ho((e, t) => {
          const n = wo({ strength: 2 }).mask(e, t),
            r = wo({ strength: 1 }).mask(e, t)
          return {
            ...n,
            borderColor: r.borderColor,
            borderColorHover: r.borderColorHover,
            borderColorPress: r.borderColorPress,
            borderColorFocus: r.borderColorFocus,
          }
        }),
        ho((e, t) => {
          const n = wo({ strength: 2 }).mask(e, t)
          return {
            ...wo({ strength: 3 }).mask(e, t),
            borderColor: n.borderColor,
            borderColorHover: n.borderColorHover,
            borderColorPress: n.borderColorPress,
            borderColorFocus: n.borderColorFocus,
          }
        }),
        ho((e, t) => {
          const n = go(e, t),
            r = wo().mask(e, t)
          return {
            ...n,
            borderColor: r.borderColor,
            borderColorHover: r.borderColorHover,
            borderColorPress: r.borderColorPress,
            borderColorFocus: r.borderColorFocus,
          }
        }),
        ho((e, t) => {
          const n = go(e, t),
            r = wo({ strength: 2 }).mask(e, t)
          return {
            ...n,
            borderColor: r.borderColor,
            borderColorHover: r.borderColorHover,
            borderColorPress: r.borderColorPress,
            borderColorFocus: r.borderColorFocus,
          }
        }))
      const Uo = {
          $0: 0,
          '$0.25': 2,
          '$0.5': 4,
          '$0.75': 8,
          $1: 20,
          '$1.5': 24,
          $2: 28,
          '$2.5': 32,
          $3: 36,
          '$3.5': 40,
          $4: 44,
          $true: 44,
          '$4.5': 48,
          $5: 52,
          $6: 64,
          $7: 74,
          $8: 84,
          $9: 94,
          $10: 104,
          $11: 124,
          $12: 144,
          $13: 164,
          $14: 184,
          $15: 204,
          $16: 224,
          $17: 224,
          $18: 244,
          $19: 264,
          $20: 284,
        },
        Go = Object.entries(Uo).map(([e, t]) => [e, Ho(t)]),
        qo = Go.slice(1).map(([e, t]) => [`-${e.slice(1)}`, -t]),
        Xo = {
          radius: {
            0: 0,
            1: 3,
            2: 5,
            3: 7,
            4: 9,
            true: 9,
            5: 10,
            6: 16,
            7: 19,
            8: 22,
            9: 26,
            10: 34,
            11: 42,
            12: 50,
          },
          zIndex: { 0: 0, 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 },
          space: { ...Object.fromEntries(Go), ...Object.fromEntries(qo) },
          size: Uo,
        }
      var Yo = n(4441)
      const Ko = typeof window < 'u',
        Qo = Ko
      Ko ? Yo.useLayoutEffect : Yo.useEffect
      ;(typeof navigator < 'u' && /Chrome/.test(navigator.userAgent || ''),
        Qo && ('ontouchstart' in window || navigator.maxTouchPoints))
      n(445)
      Yo.createContext(null)
      const Zo = ({
          font: e = {},
          sizeLineHeight: t = (e) => e + 10,
          sizeSize: n = (e) => 1 * e,
        } = {}) => {
          const o = Object.fromEntries(
            Object.entries({ ...Jo, ...e.size }).map(([e, t]) => [e, n(+t)])
          )
          return (0, r.createFont)({
            family: r.isWeb
              ? '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
              : 'System',
            lineHeight: Object.fromEntries(
              Object.entries(o).map(([e, n]) => [e, t((0, r.getVariableValue)(n))])
            ),
            weight: { 4: '300' },
            letterSpacing: { 4: 0 },
            ...e,
            size: o,
          })
        },
        Jo = {
          1: 11,
          2: 12,
          3: 13,
          4: 14,
          true: 14,
          5: 16,
          6: 18,
          7: 20,
          8: 23,
          9: 30,
          10: 46,
          11: 55,
          12: 62,
          13: 72,
          14: 92,
          15: 114,
          16: 134,
        },
        ea =
          (Zo(),
          Zo({ sizeSize: (e) => 1.4 * e }),
          {
            '2xl': { minWidth: 1536 },
            xl: { minWidth: 1280 },
            lg: { minWidth: 1024 },
            md: { minWidth: 768 },
            sm: { minWidth: 640 },
            xs: { minWidth: 460 },
            '2xs': { minWidth: 340 },
          }),
        ta = [
          '#050505',
          '#151515',
          '#191919',
          '#232323',
          '#282828',
          '#323232',
          '#424242',
          '#494949',
          '#545454',
          '#626262',
          '#a5a5a5',
          '#fff',
        ],
        na = [
          '#fff',
          '#f2f2f2',
          'hsl(0, 0%, 93%)',
          'hsl(0, 0%, 91%)',
          'hsl(0, 0%, 88%)',
          'hsl(0, 0%, 85%)',
          'hsl(0, 0%, 82%)',
          'hsl(0, 0%, 76%)',
          'hsl(0, 0%, 56%)',
          'hsl(0, 0%, 50%)',
          'hsl(0, 0%, 42%)',
          'hsl(0, 0%, 9%)',
        ],
        ra = {
          shadow1: 'rgba(0,0,0,0.04)',
          shadow2: 'rgba(0,0,0,0.08)',
          shadow3: 'rgba(0,0,0,0.16)',
          shadow4: 'rgba(0,0,0,0.24)',
          shadow5: 'rgba(0,0,0,0.32)',
          shadow6: 'rgba(0,0,0,0.4)',
        },
        oa = {
          shadow1: 'rgba(0,0,0,0.2)',
          shadow2: 'rgba(0,0,0,0.3)',
          shadow3: 'rgba(0,0,0,0.4)',
          shadow4: 'rgba(0,0,0,0.5)',
          shadow5: 'rgba(0,0,0,0.6)',
          shadow6: 'rgba(0,0,0,0.7)',
        },
        aa = {
          black1: ta[0],
          black2: ta[1],
          black3: ta[2],
          black4: ta[3],
          black5: ta[4],
          black6: ta[5],
          black7: ta[6],
          black8: ta[7],
          black9: ta[8],
          black10: ta[9],
          black11: ta[10],
          black12: ta[11],
        },
        la = {
          white1: na[0],
          white2: na[1],
          white3: na[2],
          white4: na[3],
          white5: na[4],
          white6: na[5],
          white7: na[6],
          white8: na[7],
          white9: na[8],
          white10: na[9],
          white11: na[10],
          white12: na[11],
        },
        ia = (function (e) {
          const {
              accent: t,
              childrenThemes: n,
              grandChildrenThemes: r,
              templates: o = uo,
              componentThemes: a,
            } = e,
            l = (function (e) {
              const {
                extra: t,
                childrenThemes: n = null,
                grandChildrenThemes: r = null,
                templates: o = uo,
                palettes: a = Do,
                accentTheme: l,
                componentThemes: i = o === uo ? ao : void 0,
              } = e
              let s = new No({})
                .addPalettes(a)
                .addTemplates(o)
                .addThemes({
                  light: {
                    template: 'base',
                    palette: 'light',
                    nonInheritedValues: {
                      ...t?.light,
                      ...(l &&
                        a.light_accent && {
                          accent1: a.light_accent[6],
                          accent2: a.light_accent[7],
                          accent3: a.light_accent[8],
                          accent4: a.light_accent[9],
                          accent5: a.light_accent[10],
                          accent6: a.light_accent[11],
                          accent7: a.light_accent[12],
                          accent8: a.light_accent[13],
                          accent9: a.light_accent[14],
                          accent10: a.light_accent[15],
                          accent11: a.light_accent[16],
                          accent12: a.light_accent[17],
                        }),
                    },
                  },
                  dark: {
                    template: 'base',
                    palette: 'dark',
                    nonInheritedValues: {
                      ...t?.dark,
                      ...(l &&
                        a.dark_accent && {
                          accent1: a.dark_accent[6],
                          accent2: a.dark_accent[7],
                          accent3: a.dark_accent[8],
                          accent4: a.dark_accent[9],
                          accent5: a.dark_accent[10],
                          accent6: a.dark_accent[11],
                          accent7: a.dark_accent[12],
                          accent8: a.dark_accent[13],
                          accent9: a.dark_accent[14],
                          accent10: a.dark_accent[15],
                          accent11: a.dark_accent[16],
                          accent12: a.dark_accent[17],
                        }),
                    },
                  },
                })
              return (
                a.light_accent &&
                  (s = s.addChildThemes({
                    accent: [
                      { parent: 'light', template: 'base', palette: 'light_accent' },
                      { parent: 'dark', template: 'base', palette: 'dark_accent' },
                    ],
                  })),
                n && (s = s.addChildThemes(n, { avoidNestingWithin: ['accent'] })),
                r && (s = s.addChildThemes(r, { avoidNestingWithin: ['accent'] })),
                i &&
                  (s = s.addComponentThemes(
                    ((u = i),
                    Object.fromEntries(
                      Object.entries(u).map(([e, { template: t }]) => [
                        e,
                        { parent: '', template: t || 'base' },
                      ])
                    )),
                    { avoidNestingWithin: [...Object.keys(r || {})] }
                  )),
                { themeBuilder: s, themes: s.build() }
              )
              var u
            })({
              extra: e.base.extra,
              componentThemes: a,
              palettes: Fo(Lo(e)),
              templates: o,
              accentTheme: !!t,
              childrenThemes: Ao(n),
              grandChildrenThemes: r ? Ao(r) : void 0,
            })
          return ((Mo = l.themeBuilder), l.themes)
        })({
          componentThemes: ao,
          base: {
            palette: { dark: ta, light: na },
            extra: {
              light: { ...zr, ...Ir, ...$r, ...Lr, ...ra, ...aa, ...la, shadowColor: ra.shadow1 },
              dark: { ...Fr, ...Vr, ...Wr, ...Br, ...oa, ...aa, ...la, shadowColor: oa.shadow1 },
            },
          },
          accent: { palette: { dark: na, light: ta } },
          childrenThemes: {
            black: { palette: { dark: Object.values(aa), light: Object.values(aa) } },
            white: { palette: { dark: Object.values(la), light: Object.values(la) } },
            blue: { palette: { dark: Object.values(Fr), light: Object.values(zr) } },
            red: { palette: { dark: Object.values(Wr), light: Object.values($r) } },
            yellow: { palette: { dark: Object.values(Br), light: Object.values(Lr) } },
            green: { palette: { dark: Object.values(Vr), light: Object.values(Ir) } },
          },
        }),
        sa =
          'client' === { __DEV__: !1, NODE_ENV: 'production', DEBUG: '0' }.TAMAGUI_ENVIRONMENT
            ? {}
            : ia,
        ua = o.createContext(null),
        ca = (t) => (0, e.jsx)(ua.Provider, { value: null, children: t.children })
      function da() {
        const e = o.useContext(ua)
        if (!e) return [!0, null, e]
        const { id: t, isPresent: n, onExitComplete: r, register: a } = e
        return (o.useEffect(() => a(t), []), !n && r ? [!1, () => r?.(t), e] : [!0, void 0, e])
      }
      const fa = (function (e) {
          const t = new WeakMap()
          return {
            animations: e,
            usePresence: da,
            ResetPresence: ca,
            supportsCSSVars: !0,
            useAnimatedNumber(e) {
              const [t, n] = o.useState(e),
                [r, a] = (0, o.useState)()
              return (
                s(() => {
                  r && (r?.(), a(void 0))
                }, [r]),
                {
                  getInstance: () => n,
                  getValue: () => t,
                  setValue(e, t, r) {
                    ;(n(e), a(r))
                  },
                  stop() {},
                }
              )
            },
            useAnimatedNumberReaction({ value: e }, n) {
              o.useEffect(() => {
                const r = e.getInstance()
                let o = t.get(r)
                if (!o) {
                  const e = new Set()
                  ;(t.set(r, e), (o = e))
                }
                return (
                  o.add(n),
                  () => {
                    o?.delete(n)
                  }
                )
              }, [])
            },
            useAnimatedNumberStyle: (e, t) => t(e.getValue()),
            useAnimations: ({
              props: t,
              presence: n,
              style: r,
              componentState: o,
              stateRef: a,
            }) => {
              const l = !!o.unmounted,
                i = !1 === n?.[0],
                u = n?.[1],
                [c, d] = Array.isArray(t.animation) ? t.animation : [t.animation],
                f = e[c],
                p = t.animateOnly ?? ['all']
              return (
                s(() => {
                  const e = a.current.host
                  if (!u || !i || !e) return
                  const t = e,
                    n = () => {
                      u?.()
                    }
                  return (
                    t.addEventListener('transitionend', n),
                    t.addEventListener('transitioncancel', n),
                    () => {
                      ;(t.removeEventListener('transitionend', n),
                        t.removeEventListener('transitioncancel', n))
                    }
                  )
                }, [u, i]),
                f &&
                  (Array.isArray(r.transform) &&
                    (r.transform = (0, y.transformsToString)(r.transform)),
                  (r.transition = p.map((t) => `${t} ${e[d?.[t]] ?? f}`).join(', '))),
                f ? { style: r, className: l ? 't_unmounted' : '' } : null
              )
            },
          }
        })({ lazy: 'ease-in 500ms', quick: 'ease-in 100ms' }),
        pa = {
          body: (0, r.createFont)({
            family: 'Helvetica',
            size: { 2: 12, 3: 14, 4: 16, 5: 18, 7: 22, 8: 26, 9: 32, 10: 38 },
            letterSpacing: {},
            weight: { 4: '400' },
            lineHeight: { 2: 15, 3: 17, 4: 20, 5: 24, 7: 29, 8: 33, 9: 39, 10: 46 },
          }),
          heading: (0, r.createFont)({
            family: 'Helvetica',
            size: { 2: 16, 3: 20, 4: 24, 5: 28, 6: 32, 7: 40, 8: 48, 9: 56, 10: 66 },
            letterSpacing: {},
            lineHeight: { 2: 24, 3: 30, 4: 36, 5: 42, 6: 48, 7: 60, 8: 72, 9: 84, 10: 99 },
            transform: { 5: 'uppercase', 6: 'none' },
            weight: { 4: '400', 5: '700' },
          }),
        },
        ma = (0, r.createTamagui)({
          defaultFont: 'body',
          animations: fa,
          shouldAddPrefersColorThemes: !0,
          themeClassNameOnRoot: !0,
          shorthands: Dr,
          fonts: pa,
          themes: sa,
          tokens: Xo,
          media: ea,
        }),
        ba = () =>
          (0, e.jsx)(T, {
            config: ma,
            defaultTheme: 'light',
            children: (0, e.jsxs)(f, {
              flex: 1,
              items: 'center',
              justify: 'center',
              children: [
                (0, e.jsx)(re, { children: 'Hello world' }),
                (0, e.jsx)(Mr, { zIndex: -1, fullscreen: !0, colors: ['red', 'blue'] }),
              ],
            }),
          })
      ;(0, t.createRoot)(document.querySelector('#root')).render((0, e.jsx)(ba, {}))
    })())
})()
//# sourceMappingURL=main.js.map
