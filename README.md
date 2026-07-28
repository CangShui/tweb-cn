配置：
```
mkdir -p /opt/telegram-docker
cd /opt/telegram-docker
```

1. docker-compose.yml
```
version: "3.8"

services:
  tg-reverse-proxy:
    image: nginx:1.27-alpine
    container_name: tg-reverse-proxy
    restart: always
    ports:
      - "30303:80"
    volumes:
      - ./proxy-default.conf:/etc/nginx/conf.d/default.conf:ro

  telegram-web-k:
    image: ghcr.io/cangshui/tweb-cn:1.0.7
    container_name: telegram-web-k
    restart: always
    ports:
      - "30302:80"
    environment:
      TG_PROXY_ORIGIN: tg.z894t56g18vw.org/e8r4h98w4gwe8949wg4ew98api
    command: >
      sh -c '
      echo "Inject proxy: $$TG_PROXY_ORIGIN";

      find /usr/share/nginx/html
      -type f
      \( -name "*.js" -o -name "*.html" \)
      -exec sed -i
      "s#__TG_PROXY_ORIGIN__#$$TG_PROXY_ORIGIN#g" {} \;

      pkill nginx || true;
      sleep 1;
      nginx -g "daemon off;";
      '
```
2. proxy-default.conf
```
log_format wsdebug '$remote_addr "$request" status=$status '
                   'upstream_status=$upstream_status '
                   'host=$host upstream=$tg_host '
                   'upgrade=$http_upgrade '
                   'ws_proto=$http_sec_websocket_protocol '
                   'uri=$uri args=$args';

map $http_upgrade $connection_upgrade {
  default upgrade;
  '' close;
}

server {
  listen 80;

  resolver 8.8.8.8 1.1.1.1 valid=300s ipv6=off;

  access_log /var/log/nginx/access.log wsdebug;

  proxy_http_version 1.1;
  proxy_ssl_server_name on;

  proxy_connect_timeout 10s;
  proxy_send_timeout 3600s;
  proxy_read_timeout 3600s;

  proxy_buffering off;
  proxy_request_buffering off;

  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  location /healthz {
    return 200 "ok\n";
  }

  location ~ ^/e8r4h98w4gwe8949wg4ew98api/(pluto|venus|aurora|vesta|flora|pluto-1|venus-1|aurora-1|vesta-1|flora-1)/(.*)$ {
    set $tg_host $1.web.telegram.org;
    set $tg_path $2;

    proxy_ssl_name $tg_host;

    proxy_set_header Host $tg_host;
    proxy_set_header Origin https://web.telegram.org;
    proxy_set_header Referer https://web.telegram.org/k/;
    proxy_set_header User-Agent "Mozilla/5.0";

    proxy_pass https://$tg_host/$tg_path$is_args$args;
  }

  location ~ ^/e8r4h98w4gwe8949wg4ew98api/(kws1|kws2|kws3|kws4|kws5|kws1-1|kws2-1|kws3-1|kws4-1|kws5-1)/(apiws|apiws_premium)$ {
    set $tg_host $1.web.telegram.org;
    set $tg_path $2;

    proxy_http_version 1.1;
    proxy_ssl_server_name on;
    proxy_ssl_name $tg_host;

    proxy_set_header Host $tg_host;
    proxy_set_header Origin https://web.telegram.org;
    proxy_set_header Referer https://web.telegram.org/k/;
    proxy_set_header User-Agent "Mozilla/5.0";

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Sec-WebSocket-Protocol $http_sec_websocket_protocol;
    proxy_set_header Sec-WebSocket-Key $http_sec_websocket_key;
    proxy_set_header Sec-WebSocket-Version $http_sec_websocket_version;
    proxy_set_header Sec-WebSocket-Extensions $http_sec_websocket_extensions;

    proxy_pass https://$tg_host/$tg_path$is_args$args;
  }

  location / {
    return 404;
  }
}
```
3. 启动
```
cd /opt/telegram-docker
docker compose up -d
```
验证：
```
docker ps
curl http://127.0.0.1:30303/healthz
curl -I http://127.0.0.1:30302
```

Nginx/宝塔/反代，域名配置为：
```
/      -> 127.0.0.1:30302
/e8r4h98w4gwe8949wg4ew98api -> 127.0.0.1:30303
```
