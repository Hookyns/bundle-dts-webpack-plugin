const IMPORT_REQUIRED_REGEX = /import\s+([a-z0-9A-Z_-]+)\s*=\s*require\(["']\./;
const IMPORT_REGEX = /import\s+(([a-z0-9A-Z_-]+)|(\{.*?\})|(\*\s+as\s+[a-z0-9A-Z_-]+))\s+from\s*["']\./;
const REEXPORT_REGEX = /export\s*\{[\s\S]*?\};/;
const DECLARE_REGEX = /(^|\s)declare\s+/;

class DeclarationBundlerPlugin
{
	out: string;
	moduleName: string;
	namespace: string | undefined;
	mode: string;
	excludedReferences: string[];

	constructor(options:any={})
	{
		this.out = options.out ? options.out : './build/';
		this.excludedReferences = options.excludedReferences ? options.excludedReferences : undefined;

		if(!options.moduleName && !options.namespace)
		{
			throw new Error('Please set a moduleName if you use mode:internal. new DacoreWebpackPlugin({mode:\'internal\',[moduleName | namespace]:...})');
		}
        
		this.moduleName = options.moduleName;
        this.namespace = !this.moduleName ? options.namespace : undefined;
	}

	apply(compiler)
	{
		//when the compiler is ready to emit files
		compiler.hooks.emit.tapAsync('DeclarationBundlerPlugin', (compilation,callback) =>
		{
			//collect all generated declaration files
			//and remove them from the assets that will be emited
			var declarationFiles = {};
			for (var filename in compilation.assets)
			{
				if(filename.indexOf('.d.ts') !== -1)
				{
					declarationFiles[filename] = compilation.assets[filename];
					delete compilation.assets[filename];
				}
			}

			//combine them into one declaration file
			var combinedDeclaration = this.generateCombinedDeclaration(declarationFiles);

			//and insert that back into the assets
			compilation.assets[this.out] = {
				source: function() {
					return combinedDeclaration;
				},
				size: function() {
					return combinedDeclaration.length;
				}
			};

			//webpack may continue now
			callback();
		});
	}

	private generateCombinedDeclaration(declarationFiles:Object):string
	{
		var declarations = '';
		for(var fileName in declarationFiles)
		{
			var declarationFile = declarationFiles[fileName];
			// The lines of the files now come as a Function inside declaration file.
			var data = declarationFile.source();
			var lines = data.split("\n");
			var i = lines.length;


			while (i--)
			{
				var line = lines[i];

				//exclude empty lines
				var excludeLine:boolean = line == "";

				//exclude export statements
				excludeLine = excludeLine || line.indexOf("export =") !== -1;

                //exclude re-exports
                excludeLine = excludeLine || REEXPORT_REGEX.test(line);
                
                //exclude import statements
                excludeLine = excludeLine || IMPORT_REQUIRED_REGEX.test(line) || IMPORT_REGEX.test(line);

				//if defined, check for excluded references
				if(!excludeLine && this.excludedReferences && line.indexOf("<reference") !== -1)
				{
					excludeLine = this.excludedReferences.some(reference => line.indexOf(reference) !== -1);
				}


				if (excludeLine)
				{
					lines.splice(i, 1);
				}
				else
				{
                	//declare
	                line = lines[i] = line.replace(DECLARE_REGEX, function (match, whiteSpace) {
	                	return whiteSpace;
	                });
                    
					//add tab
					lines[i] = "\t" + lines[i];
				}
			}
			declarations += lines.join("\n") + "\n\n";
		}

	    if (this.moduleName) {
		    return "declare module " + this.moduleName + "\n{\n" + declarations + "}";
	    }
        
		return "declare namespace " + this.namespace + "\n{\n" + declarations + "}";
	}

}

export = DeclarationBundlerPlugin;