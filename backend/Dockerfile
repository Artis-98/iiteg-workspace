FROM php:8.4-apache
RUN apt-get update && apt-get install -y --no-install-recommends libonig-dev \
    && docker-php-ext-install pdo_mysql mbstring \
    && rm -rf /var/lib/apt/lists/* \
    && a2enmod rewrite headers
COPY . /var/www/html/
RUN mkdir -p /var/lib/workspace/uploads && chown -R www-data:www-data /var/lib/workspace
RUN printf 'upload_max_filesize=10M\npost_max_size=12M\nexpose_php=Off\ndisplay_errors=Off\n' > /usr/local/etc/php/conf.d/workspace.ini
