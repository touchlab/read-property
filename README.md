# Read a value from a Java/JVM Properties file

Simple action to read a value from a Java Properties file. The available options seem to use a container vs just JS, which didn't work well in the situations we needed it.

This action is very simple. We're currently using it to read version info from `gradle.properties`. Here is the yaml code:

```yaml
      - uses: touchlab/read-property@main
        id: versionprop
        with:
          file: ./gradle.properties
          property: LIBRARY_VERSION
```

Accessing the value is also simple:

```yaml
      - name: Print Output
        id: output
        run: echo "${{ steps.versionprop.outputs.propVal }}"
```

The outcome in cases of an error is currently undefined. We needed a quick and simple solution to the problem at hand. If there's demand, we'll define the edge cases better in the future. Please [reach out](https://touchlab.co/keepintouch).